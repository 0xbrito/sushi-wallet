//SPDX-License-Identifier: MIT
pragma solidity >=0.6.6 <=0.9.0;
pragma experimental ABIEncoderV2;

import "./Ownable.sol";

import "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

import "./interfaces/IERC20.sol";
import "./interfaces/IMasterChef.sol";
import "hardhat/console.sol";

/**
 * @dev Staking wallet contract. A layer built on top of MasterChef and Router contracts to join Sushiswap's liquidity mining program.
 *
 * This contract's main goal is to reduce the number of steps needed to farm lp tokens, some of the TXs/instructions it handles are:
 *
 * - providing liquidity by calling {addLiquidity} to the Router contract
 * - {approve} LP tokens to MasterChef contract
 * - {deposit} LP tokens into MasterChef and start farming SUSHI
 * - Additionally, it allow user to {withdraw} tokens and get data sush as {pendingSushi} and {staked} LP tokens
 *
 * @notice User must still approve tokens to this contract in order to use your tokens.
 */
contract SushiWallet is Ownable {
    IUniswapV2Router02 public router;
    IMasterChef public chef;
    address public immutable weth;

    // pool id => staked lp amount
    mapping(uint256 => uint256) public staked;

    event Stake(uint256 pid, uint256 liquidity);

    modifier checkBalances(address[] memory tokens, uint256[] memory amounts) {
        for (uint256 i; i < tokens.length; i++) {
            //Ensure that user has enough balance
            require(
                IERC20(tokens[i]).balanceOf(msg.sender) >= amounts[i],
                "SushiWallet: Insufficient token balance"
            );
            //Ensure that user has approved tokens
            require(
                IERC20(tokens[i]).allowance(msg.sender, address(this)) >=
                    amounts[i],
                "SushiWallet: Insufficient allowance"
            );
        }
        _;
    }

    constructor(
        address _router,
        address _chef,
        address _weth
    ) public {
        require(
            _router != address(0) && _chef != address(0) && _weth != address(0),
            "SushiWallet: No zero address"
        );
        router = IUniswapV2Router02(_router);
        chef = IMasterChef(_chef);
        weth = _weth;
    }

    /// @dev Return pending SUSHI of this contract.
    function pending(uint256 _pid) public view returns (uint256 pendingSushi) {
        pendingSushi = chef.pendingSushi(_pid, address(this));
    }

    /// @notice This is the function which fulfill main goal of this contract.
    /// @notice it may not work as expected with tokens with transaction fees.
    /// @dev User must give allowance to this contract before calling this function.
    /// @param _tokens  array of token addresses, if length is 2 it will normally call {addLiquidity} to router, otherwise {addLiquidityWithETH}
    /// @param _amounts  array of amounts to add liquidity
    /// @param _amountAMin      minimal amount of {_tokenA} to provide as liquidity
    /// @param _amountBMin      minimal amount of {_tokenB} to provide as liquidity
    /// @param _pid     id of the pool to deposit LP in the MasterChef
    function deposit(
        address[] calldata _tokens,
        uint256[] calldata _amounts,
        uint256 _amountAMin,
        uint256 _amountBMin,
        uint256 _pid
    ) external payable onlyOwner checkBalances(_tokens, _amounts) {
        // Save gas
        IUniswapV2Router02 _router = router;
        if (_tokens.length == 1 && _amounts.length == 1) {
            (uint256 amountA, uint256 amountB) = _getOptimalAmounts(
                _tokens[0],
                _router.WETH(),
                _amounts[0],
                msg.value,
                _amountAMin,
                _amountBMin
            );

            if (msg.value > amountB)
                payable(msg.sender).call{value: msg.value - amountB}("");

            IERC20(_tokens[0]).transferFrom(msg.sender, address(this), amountA);
            IERC20(_tokens[0]).approve(address(_router), amountA);

            (, , uint256 liquidity) = _router.addLiquidityETH{value: amountB}(
                _tokens[0],
                amountA,
                0,
                0,
                address(this),
                block.timestamp + 30 minutes
            );
            _stake(liquidity, _pid);
        } else if (_tokens.length == 2 && _amounts.length == 2) {
            (uint256 amountA, uint256 amountB) = _getOptimalAmounts(
                _tokens[0],
                _tokens[1],
                _amounts[0],
                _amounts[1],
                _amountAMin,
                _amountBMin
            );
            IERC20(_tokens[0]).transferFrom(msg.sender, address(this), amountA);
            IERC20(_tokens[1]).transferFrom(msg.sender, address(this), amountB);

            IERC20(_tokens[0]).approve(address(_router), amountA);
            IERC20(_tokens[1]).approve(address(_router), amountB);

            (, , uint256 liquidity) = _router.addLiquidity(
                _tokens[0],
                _tokens[1],
                amountA,
                amountB,
                0,
                0,
                address(this),
                block.timestamp + 30 minutes
            );
            _stake(liquidity, _pid);
        } else {
            revert("invalid length of tokens or amounts");
        }
    }

    /// @dev Low-level function which interacts directly with MasterChef to deposit and farm lp tokens.
    function _stake(uint256 _amount, uint256 _pid) private {
        // Save gas
        IMasterChef _chef = chef;
        require(_pid <= _chef.poolLength(), "SushiWallet: Invalid pid");

        address _lp = address(_chef.poolInfo(_pid).lpToken);

        staked[_pid] += _amount;

        IERC20(_lp).approve(address(_chef), _amount);
        _chef.deposit(_pid, _amount);
        _harvest();
        emit Stake(_pid, _amount);
    }

    /// @dev Withdraw tokens from MasterChef, pass 0 as {_amount} just to harvest SUSHI.
    function withdraw(uint256 _pid, uint256 _amount) external onlyOwner {
        IUniswapV2Pair lp = IUniswapV2Pair(_withdraw(_pid, _amount));
        if (_amount > 0) {
            // save gas
            IUniswapV2Router02 _router = router;
            lp.approve(address(_router), _amount);
            _router.removeLiquidity(
                lp.token0(),
                lp.token1(),
                _amount,
                0,
                0,
                msg.sender,
                block.timestamp + 30 minutes
            );
        }
    }

    function _withdraw(uint256 _pid, uint256 _amount)
        private
        returns (address lp)
    {
        // Save gas
        IMasterChef _chef = chef;
        require(_pid <= _chef.poolLength(), "SushiWallet: Invalid pid");

        lp = address(_chef.poolInfo(_pid).lpToken);

        staked[_pid] -= _amount;
        _chef.withdraw(_pid, _amount);
        _harvest();
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) external onlyOwner {
        IMasterChef _chef = chef;
        require(_pid <= _chef.poolLength(), "SushiWallet: Invalid pid");
        uint256 amount = _chef.userInfo(_pid, address(this)).amount;
        staked[_pid] -= amount;
        _chef.emergencyWithdraw(_pid);

        IERC20 lp = _chef.poolInfo(_pid).lpToken;
        lp.transfer(msg.sender, amount);
    }

    /// @notice When calling {deposit} or {withdraw} to MasterChef, it will send any pending SUSHI to the caller.
    /// @dev This is a low-level function that will send any SUSHI obtained from interacting with MasterChef back to {msg.sender}.
    function _harvest() private {
        IERC20 sushi = chef.sushi();
        uint256 sushiBal = sushi.balanceOf(address(this));
        if (sushiBal > 0) sushi.transfer(msg.sender, sushiBal);
    }

    /// @dev piece of code extracted from UniswapV2Router02.sol contract to calculate optimal amounts before accessing user funds.
    function _getOptimalAmounts(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) private view returns (uint256 amountA, uint256 amountB) {
        (uint256 reserveA, uint256 reserveB) = UniswapV2Library.getReserves(
            router.factory(),
            tokenA,
            tokenB
        );
        uint256 amountBOptimal = UniswapV2Library.quote(
            amountADesired,
            reserveA,
            reserveB
        );
        if (amountBOptimal <= amountBDesired) {
            require(
                amountBOptimal >= amountBMin,
                "SushiWallet: INSUFFICIENT_B_AMOUNT"
            );
            (amountA, amountB) = (amountADesired, amountBOptimal);
        } else {
            uint256 amountAOptimal = UniswapV2Library.quote(
                amountBDesired,
                reserveB,
                reserveA
            );
            assert(amountAOptimal <= amountADesired);
            require(
                amountAOptimal >= amountAMin,
                "SushiWallet: INSUFFICIENT_A_AMOUNT"
            );
            (amountA, amountB) = (amountAOptimal, amountBDesired);
        }
    }
}

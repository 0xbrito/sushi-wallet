//SPDX-License-Identifier: MIT
pragma solidity >=0.6.6 <=0.9.0;
pragma experimental ABIEncoderV2;

import "./Ownable.sol";

import "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

import "./interfaces/IERC20.sol";
import "./interfaces/IMasterChef.sol";

/**
 * @dev Staking wallet contract. A layer built on top of MasterChef and Router contracts to join Sushi liquidity mining program.
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
    address public factory;
    address public immutable weth;

    // pool id => staked lp amount
    mapping(uint256 => uint256) public staked;

    event Stake(uint256 pid, uint256 liquidity);

    constructor(
        address _factory,
        address _router,
        address _chef,
        address _weth
    ) public {
        require(
            _factory != address(0) &&
                _router != address(0) &&
                _chef != address(0) &&
                _weth != address(0),
            "SushiWallet: No zero address"
        );
        factory = _factory;
        router = IUniswapV2Router02(_router);
        chef = IMasterChef(_chef);
        weth = _weth;
    }

    // Return pending sushi to this contract.
    function pending(uint256 _pid) public view returns (uint256 pending) {
        pending = chef.pendingSushi(_pid, address(this));
    }

    /// @notice User must give allowance to this contract before calling this function.
    function deposit(
        address _tokenA,
        address _tokenB,
        uint256 _amountADesired,
        uint256 _amountBDesired,
        uint256 _amountAMin,
        uint256 _amountBMin,
        uint256 _pid
    )
        external
        onlyOwner
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 liquidity
        )
    {
        require(
            IERC20(_tokenA).balanceOf(msg.sender) >= _amountADesired,
            "SushiWallet: Insufficient tokenA in balance"
        );
        require(
            IERC20(_tokenB).balanceOf(msg.sender) >= _amountBDesired,
            "SushiWallet: Insufficient tokenB in balance"
        );

        require(
            IERC20(_tokenA).allowance(msg.sender, address(this)) >=
                _amountADesired &&
                IERC20(_tokenB).allowance(msg.sender, address(this)) >=
                _amountBDesired,
            "SushiWallet: Insufficient allowance"
        );

        IERC20(_tokenA).transferFrom(
            msg.sender,
            address(this),
            _amountADesired
        );
        IERC20(_tokenB).transferFrom(
            msg.sender,
            address(this),
            _amountBDesired
        );

        // Save gas
        IUniswapV2Router02 _router = router;

        IERC20(_tokenA).approve(address(_router), _amountADesired);
        IERC20(_tokenB).approve(address(_router), _amountBDesired);

        (amountA, amountB, liquidity) = _router.addLiquidity(
            _tokenA,
            _tokenB,
            _amountADesired,
            _amountBDesired,
            _amountAMin,
            _amountBMin,
            address(this),
            block.timestamp + 30 minutes
        );
        address lp = UniswapV2Library.pairFor(
            address(factory),
            _tokenA,
            _tokenB
        );
        _stake(lp, liquidity, _pid);

        // Transfer remaining tokens to user
        uint256 remainingA = _amountADesired - amountA;
        uint256 remainingB = _amountBDesired - amountB;

        if (remainingA > 0) IERC20(_tokenA).transfer(msg.sender, remainingA);
        if (remainingB > 0) IERC20(_tokenB).transfer(msg.sender, remainingB);
    }

    /// @dev Withdraw tokens from MasterChef, pass 0 as {_amount} just to harvest SUSHI.
    function withdraw(uint256 _pid, uint256 _amount) external onlyOwner {
        require(
            staked[_pid] >= _amount,
            "SushiWallet: Insufficient staked amount"
        );
        staked[_pid] -= _amount;
        chef.withdraw(_pid, _amount);

        IERC20 sushi = chef.sushi();
        uint256 sushiBal = sushi.balanceOf(address(this));
        if (sushiBal > 0) sushi.transfer(msg.sender, sushiBal);
    }

    function _stake(
        address _lp,
        uint256 _amount,
        uint256 _pid
    ) private {
        // Save gas
        IMasterChef _chef = chef;

        require(_pid <= _chef.poolLength(), "SushiWallet: Invalid pid");
        require(
            address(_chef.poolInfo(_pid).lpToken) == _lp,
            "SushiWallet: Invalid LP token"
        );

        staked[_pid] += _amount;

        IERC20(_lp).approve(address(_chef), _amount);
        _chef.deposit(_pid, _amount);
        emit Stake(_pid, _amount);
    }
}

//SPDX-License-Identifier: MIT
pragma solidity >=0.6.6 <=0.9.0;
pragma experimental ABIEncoderV2;

import "./Ownable.sol";

import "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

import "./interfaces/IERC20.sol";
import "./interfaces/IMasterChef.sol";

import "hardhat/console.sol";

contract SushiWallet is Ownable {
    address public factory;
    IUniswapV2Router02 public router;
    IMasterChef public chef;

    address public immutable weth;

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

    /// @notice User must approve tokens to this contract before performing this function.
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

        // gas savings
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

        // transfer remaining tokens to user
        uint256 remainingA = _amountADesired - amountA;
        uint256 remainingB = _amountBDesired - amountB;

        if (remainingA > 0) IERC20(_tokenA).transfer(msg.sender, remainingA);
        if (remainingB > 0) IERC20(_tokenB).transfer(msg.sender, remainingB);
    }

    function withdraw() external onlyOwner {}

    function harvest() external {}

    function _stake(
        address _lp,
        uint256 _amount,
        uint256 _pid
    ) private {
        // gas savings

        IMasterChef _chef = chef;

        require(_pid <= _chef.poolLength(), "SushiWallet: Invalid pid");
        require(
            address(_chef.poolInfo(_pid).lpToken) == _lp,
            "SushiWallet: Invalid LP token"
        );

        IERC20(_lp).approve(address(_chef), _amount);
        _chef.deposit(_pid, _amount);
        emit Stake(_pid, _amount);
    }

    // allow wallet to receive ether
    receive() external payable {}
}

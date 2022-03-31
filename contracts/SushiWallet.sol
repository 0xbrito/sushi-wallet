//SPDX-License-Identifier: MIT
pragma solidity >=0.6.6;

import "./Ownable.sol";

import "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";

//import "@sushiswap/core/contracts/MasterChef.sol";

import "./interfaces/IERC20.sol";

contract SushiWallet is Ownable {
    IUniswapV2Factory private immutable s_factory;
    IUniswapV2Router01 private s_router;

    address private immutable s_weth;

    constructor(
        address _factory,
        address _router,
        address _weth
    ) public {
        s_factory = IUniswapV2Factory(_factory);
        s_router = IUniswapV2Router01(_router);
        s_weth = _weth;
    }

    /// @notice User must first send tokens to this contract's address in order to perform this function.
    function depositWithEth(address _token, uint256 _amountDesired)
        external
        payable
        returns (uint256 liquidity)
    {
        require(
            IERC20(_token).balanceOf(address(this)) >= _amountDesired,
            "SushiWallet: Insufficient token amount in wallet"
        );

        //save gas
        IUniswapV2Router01 router = s_router;

        IERC20(_token).approve(address(router), _amountDesired);

        (, , liquidity) = router.addLiquidityETH{value: msg.value}(
            _token,
            _amountDesired,
            (_amountDesired * 97) / 100,
            (msg.value * 97) / 100,
            address(this),
            block.timestamp + 30 minutes
        );

        address pair = UniswapV2Library.pairFor(
            address(s_factory),
            _token,
            s_weth
        );
    }

    // allow wallet to receive ether
    receive() external payable {}
}

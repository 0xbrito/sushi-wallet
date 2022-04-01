//SPDX-License-Identifier: MIT
pragma solidity >=0.6.6;

import "./Ownable.sol";

import "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";

//import "@sushiswap/core/contracts/MasterChef.sol";

import "./interfaces/IERC20.sol";

contract SushiWallet is Ownable {
    IUniswapV2Factory private immutable s_factory;
    IUniswapV2Router02 private s_router;

    address private immutable s_weth;

    constructor(
        address _factory,
        address _router,
        address _weth
    ) public {
        s_factory = IUniswapV2Factory(_factory);
        s_router = IUniswapV2Router02(_router);
        s_weth = _weth;
    }

    function depositFromETH(address _pair)
        external
        view
        onlyOwner
        returns (uint256 reserve0, uint256 reserve1)
    {
        // gas savings
        IUniswapV2Router02 router = s_router;
        (reserve0, reserve1, ) = IUniswapV2Pair(_pair).getReserves();

        //router.swapExactETHForTokens();
    }

    /// @notice User must approve tokens to this contract before executing this function.
    // function depositWithEth(address _token, uint256 _amountDesired)
    //     external
    //     payable
    //     returns (uint256 liquidity)
    // {
    //     //save gas
    //     IUniswapV2Router02 router = s_router;
    //
    //     IERC20(_token).approve(address(router), _amountDesired);
    //
    //     (, , liquidity) = router.addLiquidityETH{value: msg.value}(
    //         _token,
    //         _amountDesired,
    //         (_amountDesired * 97) / 100,
    //         (msg.value * 97) / 100,
    //         address(this),
    //         block.timestamp + 30 minutes
    //     );
    //
    //     address pair = UniswapV2Library.pairFor(
    //         address(s_factory),
    //         _token,
    //         s_weth
    //     );
    // }

    // allow wallet to receive ether
    receive() external payable {}
}

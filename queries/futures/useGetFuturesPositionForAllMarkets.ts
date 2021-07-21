import { useQuery, QueryConfig } from 'react-query';
import { useRecoilValue } from 'recoil';
import { utils as ethersUtils } from 'ethers';

import synthetix from 'lib/synthetix';
import { appReadyState } from 'store/app';
import { isL2State, walletAddressState } from 'store/wallet';

import QUERY_KEYS from 'constants/queryKeys';
import { mapFuturesPosition } from './utils';
import { FuturesPosition } from './types';

const useGetFuturesPositionForAllMarket = (
	markets: string[] | [],
	options?: QueryConfig<FuturesPosition[] | []>
) => {
	const isAppReady = useRecoilValue(appReadyState);
	const isL2 = useRecoilValue(isL2State);
	const walletAddress = useRecoilValue(walletAddressState);

	return useQuery<FuturesPosition[] | []>(
		QUERY_KEYS.Futures.Positions(markets || [], walletAddress || ''),
		async () => {
			const {
				contracts: { FuturesMarketData },
			} = synthetix.js!;
			if (!markets) return [];
			const getFuturesMarketContract = (asset: string | null) => {
				if (!asset) throw new Error(`Asset needs to be specified`);
				const contractName = `FuturesMarket${asset.substring(1)}`;
				const contract = synthetix.js!.contracts[contractName];
				if (!contract) throw new Error(`${contractName} for ${asset} does not exist`);
				return contract;
			};

			const positionsForMarkets = await Promise.all(
				(markets as [string]).map((market: string) =>
					Promise.all([
						FuturesMarketData.positionDetailsForAsset(
							ethersUtils.formatBytes32String(market),
							walletAddress
						),
						getFuturesMarketContract(market).canLiquidate(walletAddress),
					])
				)
			);

			return positionsForMarkets.map(([position, canLiquidate], i) =>
				mapFuturesPosition(position, canLiquidate, markets[i])
			);
		},
		{
			enabled: isAppReady && isL2 && !!walletAddress && markets.length > 0,
			...options,
		}
	);
};

export default useGetFuturesPositionForAllMarket;
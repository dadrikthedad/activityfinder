import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { ReactNativePlugin } from '@microsoft/applicationinsights-react-native';

const connectionString = "InstrumentationKey=b1b7ad85-8fdf-42d1-be40-1f1e41a70888;IngestionEndpoint=https://swedencentral-0.in.applicationinsights.azure.com/;LiveEndpoint=https://swedencentral.livediagnostics.monitor.azure.com/;ApplicationId=c4661461-6eb3-4ce6-a5f1-d98974a8f7ca";

const RNPlugin = new ReactNativePlugin();

const appInsights = new ApplicationInsights({
    config: {
        connectionString: connectionString,
        extensions: [RNPlugin]
    }
});

appInsights.loadAppInsights();

export default appInsights;
import * as sdk from "@codahq/packs-sdk";
export const pack = sdk.newPack();
pack.addNetworkDomain("rabbithole-1c5e.onrender.com");
pack.addMCPServer({
  name: "RabbitHole",
  endpointUrl: "https://rabbithole-1c5e.onrender.com/mcp?schema=5",
});
pack.setUserAuthentication({ type: sdk.AuthenticationType.HeaderBearerToken });

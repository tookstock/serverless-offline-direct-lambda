'use strict';

console.log("USING LOCAL SODL");

const PACKAGE_NAME = 'serverless-offline-direct-lambda';

const packagePath       = `node_modules/${PACKAGE_NAME}`;
const handlerPath       = `proxy.js`;
const directHandlerPath = `directProxy.js`;

class ServerlessPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options    = options;
    this.yaml     = serverless.service.custom[PACKAGE_NAME]

    this.setBooleanOption('directResponse')
    this.setBooleanOption('proxyAll')

    this.hooks = {
      "before:offline:start:init": this.startHandler.bind(this),
    };

    console.log(this)
  }

  startHandler() {
    let location = '';
    try {
      location = this.serverless.service.custom['serverless-offline'].location;
      this.serverless.service.custom['serverless-offline'].location = '';
    } catch (_) { }

    this.serverless.cli.log('Running Serverless Offline with direct lambda support');

    this.addProxies(this.serverless.service.functions, location);
  }

  setBooleanOption(attr) {
    if (this.options[attr] === undefined) {
      this[attr] = this.yaml[attr]
    } else {
      this[attr] = (this.options[attr] === 'true')
    }
  }

  shouldProxy(functionObject) {
    return (
      this.proxyAll
        || (!functionObject.events)
        || (functionObject.events.length === 0)
    )
  }

  addProxies(functionsObject, location) {
    Object.keys(functionsObject).forEach(fn => {

      // filter out functions with event config,
      // leaving just those intended for direct lambda-to-lambda invocation
      const functionObject = functionsObject[fn];
      if (this.shouldProxy(functionObject)) {
        const pf = this.functionProxy(functionObject, location);
        functionsObject[pf.name] = pf;
      }
    });
  };

  functionProxy(functionBeingProxied, location) {
    // const proxyPath = (this.directResponse ? directHandlerPath : handlerPath)
    return ({
      name: `${functionBeingProxied.name}_proxy`,
      handler: `${packagePath}/proxy.handler`,
      environment: functionBeingProxied.environment,
      events: [
        {
          http: {
            method: 'POST',
            path: `proxy/${functionBeingProxied.name}`,
            integration: 'lambda',
            request: {
              template: {
                'application/json': JSON.stringify(
                  {
                    location,
                    body: "$input.json('$')",
                    targetHandler :  functionBeingProxied.handler,
                  }
                )
              }
            },
            response: {
              headers: {}
            }
          }
        }
      ],
      package: {
        include: [handlerPath],
      }
    });
  }
}


module.exports = ServerlessPlugin;

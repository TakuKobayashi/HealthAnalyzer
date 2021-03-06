import type { AWS } from '@serverless/typescript';


const serverlessConfiguration: AWS = {
  service: 'health-analyzer-alexa',
  frameworkVersion: '2',
  custom: {
    webpack: {
      webpackConfig: './webpack.config.js',
      includeModules: true
    },
    alexa: {
      skills: [{
        id: "amzn1.ask.skill.f9c28415-2b9b-4ded-8d6e-fcb129dd0699",
        manifest: {
          publishingInformation: {
            locales: {
              "en-GB": {
                name: "Serverless Alexa Typescript",
              }
            }
          },
          apis: {
            custom: {
              endpoint: {
                uri: "arn:aws:lambda:[region]:[account-id]:function:[function-name]",
              }
            }
          },
        },
        manifestVersion: '1.0',
        models: {
          "en-GB": {
            interactionModel: {
              languageModel: {
                invocationName: "serverless typescript",
                intents: [{
                  name: "HelloIntent",
                  samples: [
                    'hello'
                  ],
                }],
              },
            },
          },
        },
      }],
    },
  },
  plugins: [
    'serverless-webpack',
    'serverless-alexa-skills',
    'serverless-offline',
  ],
  provider: {
    name: 'aws',
    runtime: 'nodejs12.x',
    apiGateway: {
      minimumCompressionSize: 1024,
      shouldStartNameWithService: true,
    },
    environment: {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
    },
    lambdaHashingVersion: '20201221',
  },
  functions: {
    alexa: {
      handler: "handler.alexa",
      events: [
        {
          alexaSkill: "${self:custom.alexa.skills.0.id}"
        }
      ],
    },
  },
}

module.exports = serverlessConfiguration;

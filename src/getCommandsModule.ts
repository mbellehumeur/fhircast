import { CommandsManager, ExtensionManager } from '@ohif/core';
import FhircastService from './services/FhircastService';

export default function getCommandsModule({
  servicesManager,
  commandsManager,
  extensionManager,
}: {
  servicesManager: AppTypes.ServicesManager;
  commandsManager: CommandsManager;
  extensionManager: ExtensionManager;
}) {
  const { FhircastService } = servicesManager.services;

  const actions = {
    sendFhircast: ({ fhircastMessage}) => {
      console.log('Fhircast sent.');
      FhircastService.fhircastPublish(fhircastMessage)
    },
    sendPriorToReport: ({ studyUID}) => {
      console.log('Fhircast sendPriorToReport.');
      //FhircastService.fhircastPublish(fhircastMessage)
    },
  }
  const definitions = {
    sendFhircast: {
      commandFn: actions.sendFhircast,
    },
    sendPriorToReport: {
      commandFn: actions.sendPriorToReport,
    },
  };

  return {
    actions,
    definitions,
    defaultContext: 'FHIRCAST',
  };
}

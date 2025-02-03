import { ServicesManager, CommandsManager, ExtensionManager } from '@ohif/core';
import OHIF, { Types, errorHandler } from '@ohif/core';
import createDRupdatefromMeasurement from './utils/createDRupdatefromMeasurement'

export default class IHEService {
  private _extensionManager: ExtensionManager;
  private _servicesManager: ServicesManager;
  private _commandsManager: CommandsManager;

  public static REGISTRATION = servicesManager => {
    return {
    name: 'radaiService',
    altName: 'RadaiService',
    create: ({ extensionManager, commandsManager, servicesManager }) => {
      return new IHEService(extensionManager, commandsManager, servicesManager);
    }
  }
  }

  constructor(
    extensionManager: ExtensionManager,
    commandsManager: CommandsManager,
    servicesManager: ServicesManager
  ) {
    console.debug('RadaiService: creating service ');
    this._commandsManager = commandsManager;

    const { MeasurementService } = servicesManager.services;

    const {MEASUREMENT_ADDED, MEASUREMENT_REMOVED, MEASUREMENTS_CLEARED, MEASUREMENT_UPDATED, RAW_MEASUREMENT_ADDED } =
    MeasurementService.EVENTS;
    MeasurementService.subscribe(
        MEASUREMENT_ADDED,
        ({ source, measurement: addedMeasurementId }) => {
            console.log('IHE: measurement added ');

            const fhirContext= createDRupdatefromMeasurement(addedMeasurementId);
            const hub=FhircastService.getHub();
            const response =  FhircastService.fhircastPublish(fhirContext,hub);

        //    this._commandsManager.runCommand('sendFhircast', fhirContext ,'FHIRCAST');
        }
      );

      const { FhircastService } = servicesManager.services;

      const {FHIRCAST_MESSAGE, } =
      FhircastService.EVENTS;
      FhircastService.subscribe(
        FHIRCAST_MESSAGE,
          ({ fhirMessage: fhirMessage }) => {
              console.log('RadaiService: fhircast message received :',fhirMessage);

              const currentLocation = window.location.search;
              if (fhirMessage.event['hub.event'].toLowerCase() === 'patient-open') {
                if (fhirMessage.event.context) {
                  let mrn = null;
                  fhirMessage.event.context.forEach(contextResource => {
                    if (contextResource.key.toLowerCase() === 'patient') {
                      mrn = contextResource.resource.identifier[0].value;
                    }
                  });
                  console.debug('RadaiService: patient-open for mrn:' + mrn);
                  this._commandsManager.runCommand('navigateHistory', { to: '/?mrn=' + mrn });
                } else {
                  console.warn('RadaiService: mrn not found in  patient-open message.');
                }
              }
              if (
                currentLocation != '' &&
                fhirMessage.event['hub.event'].toLowerCase() === 'patient-close'
              ) {
                this._commandsManager.runCommand('navigateHistory', { to: '/' });
              }
              if (fhirMessage.event['hub.event'].toLowerCase() === 'imagingstudy-open') {
                let studyUID = null;
                fhirMessage.event.context.forEach(contextResource => {
                  if (contextResource.key.toLowerCase() === 'study') {
                    studyUID = contextResource.resource.uid.replaceAll('urn:oid:', '');
                  }
                });
                if (studyUID !== null && !currentLocation.includes(studyUID)) {
                  console.debug('RadaiService:  imagingstudy-open, opening ' + studyUID);
                  this._commandsManager.runCommand('navigateHistory', {
                    to: '/viewer?StudyInstanceUIDs=' + studyUID + '&FHIRcast',
                  });
                } else if (studyUID === null) {
                  console.debug('RadaiService:  imagingstudy-open, studyUID not found in message');
                } else if (currentLocation.includes(studyUID)) {
                  console.debug('RadaiService:  imagingstudy-open, studyUID already open');
                }
              }
              if (
                currentLocation != '' &&
                fhirMessage.event['hub.event'].toLowerCase() === 'imagingstudy-close'
              ) {
                this._commandsManager.runCommand('navigateHistory', { to: '/' });
              }
              //   if ( fhirMessage.event['hub.event'].toLowerCase().includes('diagnosticreport-open')) {
              //  const studyUID=fhirMessage.event.context[1].identifier[0].value;
              // const accNbr=fhirMessage.event.context[1].identifier[0].value;
              // console.debug('FhircastService:  Opening '+studyUID);
              //this._commandsManager.runCommand('navigateHistory',{to:'/viewer?StudyInstanceUIDs='+studyUID});
              // this._commandsManager.runCommand('navigateHistory',{to:'/viewer?acc='+accNbr});
              //     }
              if (
                currentLocation != '' &&
                fhirMessage.event['hub.event'].toLowerCase() === 'diagnosticreport-close'
              ) {
                console.debug('RadaiService:  Closing viewer');
                this._commandsManager.runCommand('navigateHistory', { to: '/' });
              }

              if (fhirMessage.event['hub.event'].toLowerCase().includes('diagnosticreport-select')) {
                console.debug('RadaiService:  imagingselection, opening ' + studyUID);
                /*
                const studyUID = fhirMessage.event.context[1].resources[0].studyUid;
                const seriesUID = fhirMessage.event.context[1].resources[0].seriesUid;
                console.debug('FhircastService:  imagingselection, opening ' + studyUID);
                this._commandsManager.runCommand('navigateHistory', {
                  to:
                    '/viewer?StudyInstanceUIDs=' +
                    studyUID +
                    '&SeriesInstanceUIDs=' +
                    seriesUID +
                    '&FHIRcast',
                });
    
                */
              }



          }
        );

  }

}
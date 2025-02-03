import { ServicesManager, CommandsManager, ExtensionManager, DicomMetadataStore } from '@ohif/core';
import createDRupdatefromMeasurement from './utils/createDRupdatefromMeasurement'

export default class RadaiService {
  private _extensionManager: ExtensionManager;
  private _servicesManager: ServicesManager;
  private _commandsManager: CommandsManager;

  public static REGISTRATION = servicesManager => {
    return {
    name: 'radaiService',
    altName: 'RadaiService',
    create: ({ extensionManager, commandsManager, servicesManager }) => {
      return new RadaiService(extensionManager, commandsManager, servicesManager);
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
          const studyMeta = DicomMetadataStore.getStudy(addedMeasurementId.referenceStudyUID);
          const fhirContext= createDRupdatefromMeasurement(addedMeasurementId,studyMeta);
          const hub=FhircastService.getHub();
          const response =  FhircastService.fhircastPublish(fhirContext,hub);
          console.debug('RadaiService: sending measurement ',fhirContext);
        //    this._commandsManager.runCommand('sendFhircast', fhirContext ,'FHIRCAST');
        }
      );

      const { FhircastService } = servicesManager.services;

      const {FHIRCAST_MESSAGE, } =
      FhircastService.EVENTS;
      FhircastService.subscribe(
        FHIRCAST_MESSAGE,
          ({ fhirMessage: fhirMessage }) => {
              console.log('RadaiService: Handling fhircast message ',fhirMessage.event['hub.event']);
              const currentLocation = window.location.search;
              
              if ( fhirMessage.event['hub.event'].toLowerCase().includes('diagnosticreport-open')) {
              //  const studyUID=fhirMessage.event.context[1].identifier[0].value;
              // const accNbr=fhirMessage.event.context[1].identifier[0].value;
              // console.debug('FhircastService:  Opening '+studyUID);
              //this._commandsManager.runCommand('navigateHistory',{to:'/viewer?StudyInstanceUIDs='+studyUID});
              // this._commandsManager.runCommand('navigateHistory',{to:'/viewer?acc='+accNbr});
              }
              if (
                currentLocation != '' &&
                fhirMessage.event['hub.event'].toLowerCase() === 'diagnosticreport-close'
              ) {
                console.debug('RadaiService:  Closing viewer');
                this._commandsManager.runCommand('navigateHistory', { to: '/' });
              }

              if (fhirMessage.event['hub.event'].toLowerCase().includes('diagnosticreport-select')) {
                //console.debug('RadaiService:  imagingselection, opening ' + studyUID);
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
# FHIRcast client
## Introduction  

The FHIRcast standard synchronizes healthcare applications in real time.   Health IT users often work in many disparate applications at the same time (worklist, PACS,dictation,EMR, AI, ect).  FHIRcast enables sharing FHIR resources between all the applications even when running on a different computer through the use of a central hub that distributes the messages.  The FHIRcast standard will help lower cost and accelerate real-time health IT integration across desktop and mobile applications. Find out more at fhircast.org.

## Installation

- Run from the \Viewers directory:
```bash
yarn cli add-extension fhircast
yarn install
```

- Copy radai.js configuration file to  \Viewers\platform\app\public\config\radai.js.

- Set the configuration file in \Viewers\platform\app\.env 
```env 
APP_CONFIG=config/radai.js
```
- Run from the \Viewers directory:
```bash
yarn run dev:fast
```

## Description
The extension is composed of a main service named ‘FhircastService.ts’ which is always started when the ‘fhircast’ configuration item is found.  
This service handles:
- Connection to the hub (token, subscription, heartbeat, reconnect on loss of websocket, etc). 
- Publishing messages to the hub.
- Broadcasting  FHIRCAST_MESSAGE events when a message is received from the hub on the websocket connection.

The FhircastService does not process the messages it handles.  This is done by one of the project specific services, for example, ‘RadaiService.ts’.  

These services are vendor/site specific and only one of them is configured to be loaded  through the extension index.tsx file. 

The services listen for events from the FhircastService, MeasurementService, HotKeys and any other event that is relevant to the specific integration.  They send out FHIRcast messages, for example, maesurements, through the FhircastService.  

## Author 
 Martin Bellehumeur
## License 
MIT
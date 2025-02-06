/*
FhircastService

  public async fhircastPublish(fhircastMessage) -returns response.status

  processEvent

  public async getToken()
  public async fhircastSubscribe()
  public async fhircastUnsubscribe()

  public setHub(hubName: string) : boolean
  public getHub() : returns the hub object if set.
  public setTopic(topic: string)
  public getTopic(topic: string) :string

*/
import { ServicesManager, CommandsManager, ExtensionManager, PubSubService } from '@ohif/core';
import { ConferenceModal } from './utils/conferenceModal';

export default class FhircastService extends PubSubService {
  private _extensionManager: ExtensionManager;
  private _servicesManager: ServicesManager;
  private _commandsManager: CommandsManager;

  public static EVENTS = {
    FHIRCAST_MESSAGE: 'event::fhircastMessage',
    HUB_SUBSCRIBED: 'event::hubSubscribed',
    HUB_UNSUBSCRIBED: 'event::hubUnsubscribed',
    WEBSOCKET_CLOSE: 'event::websocketClose',
    TOKEN_ACQUIRED: 'event::tokenAcquired',
    STUDY_CLOSE: 'event::studyClose',
  };

  public static REGISTRATION = servicesManager => {
    return {
    name: 'fhircastService',
    altName: 'FhircastService',
    create: ({ extensionManager, commandsManager, servicesManager }) => {
      return new FhircastService(extensionManager, commandsManager, servicesManager);
    }
  }
  }

  public hub = {
    name: '',
    friendlyName: '',
    productName: '',
    enabled: false,
    events: [],
    lease: 999,
    hub_endpoint: '',
    authorization_endpoint: '',
    token_endpoint: '',
    token: '',
    subscriberName: '',
    topic: '',
    lastPublishedMessageID: '', // to filter event echo
    subscribed: false,
    resubscribeRequested: false,
    websocket: null,
  };

  public conferenceApproved = false;
  public conferenceDeclined = false;
  
  constructor(
    extensionManager: ExtensionManager,
    commandsManager: CommandsManager,
    servicesManager: ServicesManager
  ) {
    console.debug('FhircastService: creating service ');

    super(FhircastService.EVENTS);
    this._extensionManager = extensionManager;
    this._commandsManager = commandsManager;
    this._servicesManager = servicesManager;
    this.fhircastConfig = extensionManager.appConfig.fhircast;
    if (this.fhircastConfig.defaultHub) {
      const result = this.setHub(this.fhircastConfig.defaultHub);
      if (this.fhircastConfig.autoStart) {
        this.getToken();
      }
    }
    const interval = setInterval(() => {
      this.checkWebsocket(interval);
    }, 10000);
  }

  private checkWebsocket = async interval => {
    // resubscribe every 10secs if the websocket disconnects
    //console.debug('FhircastService: checking websocket '  );

    if (this.hub.resubscribeRequested && this.hub.subscribed && this.fhircastConfig.autoReconnect) {
      console.debug('FhircastService: Try to resubscribe ');
      this.hub.resubscribeRequested = false;
      const response = await this.fhircastSubscribe();
      if (response == 202) {
        this.hub.resubscribeRequested = false;
      } else {
        this.hub.resubscribeRequested = true;
      }
    } else if (!this.hub.subscribed && this.hub.resubscribeRequested) {
      this.hub.resubscribeRequested = false;
    }
  };

 
  public setHub(hubName: string): boolean {
    if (hubName === this.hub.name) {
      console.debug('FhircastService: setHub: hub already set to ' + hubName);
      return true;
    }
    console.debug('FhircastService: setting hub to ' + hubName);
    try {
      if (this.fhircastConfig.hubs) {
        this.fhircastConfig.hubs.forEach(hubconfig => {
          if (hubconfig.enabled && hubconfig.name === hubName) {
            if (this.hub.subscribed) {
              this.fhircastUnsubscribe();
            }
            this.hub = hubconfig;
            this.hub.subscribed = false;
            return true;
          }
        });
      } else {
        console.debug('FhircastService: hub not found in configuration ' + hubName);
        return false;
      }
    } catch (err) {
      console.warn('FhircastService: Unable to set the hub to  ' + hubName);
      return false;
    }
  }

  public getHub() {
    console.debug('FhircastService: getHub: hub is ' + this.hub.name);
    return this.hub;
  }

  public getTopic(topic: string): string {
    console.debug('FhircastService: getTopic called.');
    return this.hub.topic;
  }

  public setTopic(topic: string) {
    console.debug('FhircastService: setting topic to ' + topic);
    this.hub.topic = topic;
    this.hub.subscriberName = 'OHIF-' + topic + '-' + Math.random().toString(36).substring(2, 16);
  }
  public setConferenceApproved(request: boolean) {}

  public async getToken() {
    console.debug('FhircastService: Getting token.');
    const tokenFormData = new URLSearchParams();
    tokenFormData.append('grant_type', 'client_credentials');
   //    tokenFormData.append('client_id',process.env.REACT_APP_FHIRCAST_CLIENT_ID);
   //    tokenFormData.append('client_secret',process.env.REACT_APP_FHIRCAST_CLIENT_SECRET);
    tokenFormData.append('client_id', this.hub.client_id);
    tokenFormData.append('client_secret', this.hub.client_secret);
    
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenFormData,
    };
    try {
      const response = await fetch(this.hub.token_endpoint, requestOptions);
      if (response.status == 200) {
        const config = await response.json();
        if (config.access_token) {
          console.debug('FhircastService:  Token received.');
          this.hub.token = config.access_token;
          this._broadcastEvent(FhircastService.EVENTS.TOKEN_ACQUIRED, {});
        }
        if (this.hub.productName === 'RAD-AI') {
          config.topic = this.hub.topic;
          //this.setTopic('ohif');
        }

        if (config.topic) {
          console.debug('FhircastService:  Topic received.', config.topic);
          this.setTopic(config.topic);
          if (this.fhircastConfig.autoStart) {
            this.fhircastSubscribe();
          }
        }
        return true;
      } else {
        console.debug('FhircastService: Error getting token.');
        return false;
      }
    } catch (err) {
      console.warn('FhircastService: Error getting token:', err.message);
      return false;
    }
  }

  public async fhircastUnsubscribe() {
    this.hub.subscribed = false;
    this.hub.resubscribeRequested = false;
    const subscribeFormData = new URLSearchParams();
    subscribeFormData.append('hub.mode', 'unsubscribe');
    subscribeFormData.append('hub.channel.type', 'websocket');
    subscribeFormData.append('hub.callback', window.location.origin + '/fhircastCallback');
    subscribeFormData.append('hub.events', this.hub.events.toString());
    subscribeFormData.append('hub.topic', this.hub.topic);
    subscribeFormData.append('hub.lease', this.hub.lease.toString());
    subscribeFormData.append('subscriber.name', this.hub.subscriberName);
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Bearer ' + this.hub.token,
      },
      body: subscribeFormData,
      signal: AbortSignal.timeout(5000),
    };
    try {
      const response = await fetch(this.hub.hub_endpoint, requestOptions);
      if (response.status == 202) {
        const subscriptionResponse = await response.json();
        console.debug('FhircastService: Unsubscribe successfully from hub ' + this.hub.name);
        this._broadcastEvent(FhircastService.EVENTS.HUB_UNSUBSCRIBED, {});
      } else {
        console.debug('FhircastService: Unsubscribe refused by the hub. ');
      }
    } catch (err) {
      console.warn('FhircastService: Error unsubscribing from the hub.', err.message);
    }
    if (this.hub.websocket) {
      this.hub.websocket.close();
    }
  }

  private processEvent(eventData) {
    try {
      const fhirMessage = JSON.parse(eventData);
      if (fhirMessage['hub.mode']) {
        console.debug('FhircastService: Subscription acknowledged on the websocket.');
      }
      if (fhirMessage.event) {
        if (fhirMessage.event['hub.event'] === 'heartbeat') {
          console.debug('FhircastService: Received websocket heartbeat from hub ' + this.hub.name);
        } else if (fhirMessage.id === this.hub.lastPublishedMessageID) {
          console.debug(
            'FhircastService: Received echo of event ' +
              fhirMessage.event['hub.event'] +
              ', id:' +
              fhirMessage.id
          );
        } else if (fhirMessage.event) {

          console.debug('FhircastService: websocket received data: ', fhirMessage);
          this._broadcastEvent(FhircastService.EVENTS.FHIRCAST_MESSAGE, {fhirMessage});

          // Check if the topic is different.  This means we are entering a conference
          /* 
          if (fhirMessage.event['hub.topic'].toLowerCase() !== this.hub.topic) {
            console.debug('FhircastService:  Conference starting');
            const { UIModalService } = this._servicesManager.services;
            if (!this.conferenceApproved && !this.conferenceDeclined) {
              UIModalService.show({
                content: ConferenceModal,
                containerDimensions: 'h-[125px] w-[300px]',
                title: fhirMessage.event['hub.topic'] + ' conference starting!',
                contentProps: {
                  onClose: UIModalService.hide,
                },
              });
            }
            this.conferenceApproved = true;    
          }
          */
        }
      }
    } catch (err) {
      console.warn('FhircastService: websocket processing error: ', err);
    }
  }

  private websocketClose() {
    console.debug('FhircastService: websocket is closed.');
    this.hub.resubscribeRequested = true;
    this._broadcastEvent(FhircastService.EVENTS.WEBSOCKET_CLOSE, {});
  }

  public async fhircastSubscribe() {
    if (this.hub.topic === undefined) {
      console.warn('FhircastService: Error. subscription not sent. No topic defined.');
      return 'error: topic not defined';
    }
    const subscribeFormData = new URLSearchParams();
    subscribeFormData.append('hub.mode', 'subscribe');
    subscribeFormData.append('hub.channel.type', 'websocket');
    subscribeFormData.append('hub.callback', window.location.origin + '/fhircastCallback');
    subscribeFormData.append('hub.events', this.hub.events.toString());
    subscribeFormData.append('hub.topic', this.hub.topic);
    subscribeFormData.append('hub.lease', this.hub.lease.toString());
    subscribeFormData.append('subscriber.name', this.hub.subscriberName);
    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Bearer ' + this.hub.token,
      },
      body: subscribeFormData,
      signal: AbortSignal.timeout(5000),
    };
    try {
      const response = await fetch(this.hub.hub_endpoint, requestOptions);
      if (response.status == 202) {
        this.hub.subscribed = true;
        this.hub.resubscribeRequested = false;
        const subscriptionResponse = await response.json();
        console.debug(
          'FhircastService: subscribe response: ' + JSON.stringify(subscriptionResponse)
        );
        const websocket_url = subscriptionResponse['hub.channel.endpoint'];
        this.hub.websocket = new WebSocket(websocket_url); //  open websocket
        this.hub.websocket.onopen = function () {
          console.debug('FhircastService: websocket is connected.'); // Nuance wants the endpoint back after connection I think
          this.send('{"hub.channel.endpoint":"' + websocket_url + '"}');
        };
        this.hub.websocket.addEventListener('message', ev => this.processEvent(ev.data));
        this.hub.websocket.addEventListener('close', () => this.websocketClose());
        this.hub.websocket.onerror = function () {
          console.warn('FhircastService: Error reported on websocket:');
        };

        this._broadcastEvent(FhircastService.EVENTS.HUB_SUBSCRIBED, {});
      } else if (response.status == 401) {
        console.debug('FhircastService: Subscription response 401 -Token refresh needed here.');
        this.getToken();
      } else {
        console.debug('FhircastService: Subscription rejected by hub:', response.status);
      }
      return response.status;
    } catch (err) {
      console.warn('FhircastService: Error subscribing to the hub.', err.message);
    }
  }

  public async fhircastPublish(fhircastMessage,hub) {
    
    const timestamp = new Date();
    fhircastMessage.timestamp = timestamp.toJSON();
    fhircastMessage.id = 'OHIF-' + Math.random().toString(36).substring(2, 16);
    this.hub.lastPublishedMessageID = fhircastMessage.id; // to filter event echo from the hub
    //fhircastMessage.event['hub.topic'] = this.hub.topic;
    fhircastMessage.event['hub.topic'] = hub.topic;
    const message = JSON.stringify(fhircastMessage);
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.hub.token },
      body: message,
    };
    try {
      console.debug('FhircastService: Publishing message to FHIRcast hub: ' + fhircastMessage);
     // let hubEndpoint = this.hub.hub_endpoint + '/' + this.hub.topic;
     let hubEndpoint = hub.hub_endpoint + '/' + hub.topic;
     
     if (hub.productName === 'PHILIPS') {
        hubEndpoint = hub.hub_endpoint;
      }
      const response = await fetch(hubEndpoint, requestOptions);
      return response;
    } catch (err) {
      console.debug(err.message);
      return null;
    }
  }
}

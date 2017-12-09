import {Component, OnInit, ViewChild} from '@angular/core';
import {UserService} from '../../shared/services/user.service';
import {EventService} from '../../shared/services/event.service';
import {User} from '../../shared/models/user';
import {Event} from '../../shared/models/event';
import { ActivatedRoute } from '@angular/router';
import {AuthenticationService} from '../../authentication/authentication.service';
import { Router } from "@angular/router";
import {DialogService} from "../../shared/dialog/dialog.service";
import {FacebookService, UIParams, UIResponse, InitParams} from "ngx-facebook/dist/esm/index";
import {RouteService} from "../../shared/services/route.service";
import {} from '@types/googlemaps';


declare var google: any;

@Component({
  selector: 'app-event-detail-page',
  templateUrl: './event-detail-page.component.html',
  styleUrls: ['./event-detail-page.component.css']
})
export class EventDetailPageComponent implements OnInit {

  private eventId: String;

  private random;

  private href = '';

  private event: Event = new Event();
  private currentUser: User = new User();
  private organizer: User = new User();
  private similarEvents: Event[];

  // ids of participants
  private participantsList = [];
  private mapPoints: any;
  private initLat: number;
  private initLong: number;
  private directions: any;
  travelModeInput= "WALKING";

  errors: Error[] = [];

  constructor(private route: ActivatedRoute,
              private userService: UserService,
              private eventService: EventService,
              private authService: AuthenticationService,
              private router: Router,
              private fb: FacebookService,
              private routeService: RouteService,
              private dialogService: DialogService) {
    // init Facebook strategy
    const initParams: InitParams = {
      appId: '278876872621248',
      xfbml: true,
      version: 'v2.11'
    };
    this.fb.init(initParams);

    console.log('[EventDetailPage][constructor]')
  }


  ngOnInit() {

    this.errors = [];

    this.href = window.location.href;

    this.route.params.subscribe(params => {
      this.eventId = params['eventId'];
      console.log('[EventDetail][OnInit]', this.eventId);

      this.routeService.getRoute(this.eventId)
        .then(
          (coordinates) => {
            console.log('[Route Management][OnInit][success]', coordinates);
            console.log('[Route Management][OnInit][Coordinates detected]', coordinates);
            this.mapPoints = coordinates;
            if(this.mapPoints.length > 0){
              this.initLat = this.mapPoints[0].lat;
              this.initLong = this.mapPoints[0].lng;
              this.getRoutePointsAndWaypoints();
            }
          }
        )
        .catch(
          (error) => {
            console.log('[Route Management][OnInit][error]', error);
          }
        );

      this.eventService.getEvent(this.eventId)
        .then(
          (event) => {
            console.log('[EventDetail][OnInit][EventService.getEvent][success]', event);
            // TODO add a check: if the event is null redirect somewhere maybe showing an alert
            this.event = event;

            this.eventService.getSimilarEvents(3, this.event.type)
              .then(
                (similarEvents) => {
                  console.log('[EventDetail][OnInit][EventService.getSimilarEvents][success]', similarEvents);
                  this.similarEvents = similarEvents;
                }
              )
          }
        )
        .catch(
          (error) => {
            console.log('[EventDetail][OnInit][EventService.getEvent][error]', error);
          }
        );

      this.userService.getUser()
        .subscribe(
          (user) => {
            this.currentUser = user
          });

      this.getOrganizer();

      this.getParticipants()
    });

    console.log('[Event-Detail-Component][OnInit][Event]', this.event);



    this.random = Math.random();
  }

  shareWithFacebook(){
    let params: UIParams = {
      href: this.href,
      method: 'share'
    };

    this.fb.ui(params)
      .then((res: UIResponse) => console.log(res))
      .catch((e: any) => console.error(e));
  }


  getRoutePointsAndWaypoints(){
    let waypoints = [];

    if (this.mapPoints.length > 2){
      for(let i=1; i<this.mapPoints.length-1; i++){
        let address = this.mapPoints[i];
        if(address !== ""){
          waypoints.push({
            location: address,
            stopover: true //show marker on map for each waypoint
          });
        }
        this.updateDirections(this.mapPoints[0], this.mapPoints[this.mapPoints.length-1],waypoints);
      }
    }else if(this.mapPoints.length > 1){
      this.updateDirections(this.mapPoints[this.mapPoints.length-2], this.mapPoints[this.mapPoints.length-1], waypoints);
    }else {
      this.updateDirections(this.mapPoints[this.mapPoints.length-1], this.mapPoints[this.mapPoints.length -1 ], waypoints);
    }
  }

  updateDirections(originAddress, destinationAddress, waypoints){
    this.directions = {
      origin: {lat: originAddress.lat, lng: originAddress.lng},
      destination: {lat: destinationAddress.lat, lng: destinationAddress.lng},
      waypoints: waypoints
    };
    console.log("[Directions][Update]", this.directions);
  }

  /**
   * It calls the event service in order to get the organizer profile.
   */
  private getOrganizer() {
    this.eventService.getOrganizer(this.eventId)
      .then(
        (organizer) => {
          console.log('[EventDetail][OnInit][EventService.getOrganizer][success]', organizer);
          this.organizer = organizer;
        }
      )
      .catch(
        (error) => {
          console.log('[EventDetail][OnInit][EventService.getOrganizer][error]', error);
        }
      )
  }

  /**
   * It calls the event service in order to get the participants list.
   */
  private getParticipants() {
    this.eventService.getParticipants(this.eventId)
      .then(
        (participants) => {
          console.log('[EventDetail][OnInit][EventService.getParticipants]', participants);
          this.participantsList = participants;
        }
      )
  }

  isLogged(): boolean {
    return this.authService.isAuthenticated()
  }

  getDate(date: Date): String {
    if (date) {
      console.log(date);
      return null;
    } else {
      return (date.getDate().toString() + '/' + (date.getMonth() + 1).toString() + '/' +
        date.getFullYear().toString());
    }
  }

  /**
   * It calls the event service to enroll the user.
   */
  enroll() {

    if(this.enrollementIsOpen()) {
      this.eventService.enrollToEvent(this.eventId)
        .then(
          (response) => {
            console.log('[EventDetail][enroll][success]', response);
            // get the new list of particpants to update the buttons
            this.getParticipants();
            this.dialogService.confirmation("Success", "You are correctly enrolled",function(){

            });
          }
        )
        .catch(
          (error) => {
            console.log('[EventDetail][enroll][error]', error);
            this.errors = error;
          }
        );
    } else {
      this.dialogService.confirmation("Enrollement",
        "Sorry the registration period is CLOSED or not yet AVAILABLE",function(){
      });
    }
  }

  enrollementIsOpen(): boolean {
    let today = new Date();
    var initialOpen = this.event.enrollmentOpeningAt;
    var initialClose = this.event.enrollmentClosingAt;
    let open = null;
    let close = null;

    if (initialOpen != null && initialClose != null) {
      var split_open = initialOpen.split(/\//);
      let split_close = initialClose.split(/\//);
      open = new Date(+split_open[2], +split_open[1] - 1, +split_open[0]);
      close = new Date(+split_close[2], +split_close[1] - 1, +split_close[0]);
    } else if (initialOpen != null) {
      var split_open = initialOpen.split(/\//);
      open = new Date(+split_open[2], +split_open[1] - 1, +split_open[0]);
    }

    console.log("Today", today);
    console.log("open", open);
    console.log("close", close);


    if (this.event.enrollmentOpeningAt && this.event.enrollmentClosingAt) {
        return today >= open && today<= close;
    }else {
      return false;
    }
  }



  /**
   * It calls the event service to withdraw the enrollment of the user.
   */
  withdrawEnrollment() {
    console.log('[EventDetail][withdrawEnrollment]');
    this.dialogService.confirmation('Withdraw enrollment', 'Are you sure to withdraw your enrollment for this event?', function () {
      console.log('[EventDetail][withdrawEnrollment][callback]');
      this.eventService.withdrawEnrollment(this.eventId, this.currentUser.id)
        .then(
          (response) => {
            console.log('[EventDetail][withdrawEnrollment][success]', response);
            // get the new list of particpants to update the buttons
            this.getParticipants()
          }
        )
        .catch(
          (error) => {
            console.log('[EventDetail][withdrawEnrollment][error]', error);
              this.errors = error;
          }
        );
    }.bind(this));

  }

  /**
   * It says if the logged user, if any, is already enrolled in the events.
   * @returns {boolean}
   */
  isEnrolled() {
    return this.participantsList.includes(this.currentUser.id)
  }

  /**
   * It deletes an event when an event organizer decides to do it
   */
  deleteEvent() {
    console.log('[EventDetail][deleteEvent]');
    this.dialogService.confirmation('Delete event', 'Are you sure to delete this event?', function () {
      console.log('[EventDetail][deleteEvent][callback]');
      this.eventService.deleteEvent(this.eventId)
        .then(
          (response) => {
            console.log('[EventDetail][deleteEvent][success]', response);
            this.router.navigate(['/my-events']);
          }
        )
        .catch(
          (error) => {
            console.log('[EventDetail][deleteEvent][error]', error);
            // TODO show errors
          }
        );
    }.bind(this));
  }

 /** similarEvents() {
    this.eventService.getSimilarEvents(3)
      .then(
        (events) => {
          console.log('[Event Detail][getSimilarEvents][success]', events);
          this.similarEvents = events
        }
      )
      .catch(
        (error) => {
          console.log('[Event Detail][getSimilarEvents][error]', error);
        }
      );
  }**/
}



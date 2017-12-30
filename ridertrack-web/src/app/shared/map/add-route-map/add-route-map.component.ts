import {Component, ElementRef, NgZone, OnInit, ViewChild, ViewEncapsulation} from '@angular/core';
import { MapsAPILoader, MouseEvent as AGMMouseEvent} from "@agm/core";
import {} from '@types/googlemaps';
import {FormControl} from "@angular/forms";
import {RouteService} from "../../services/route.service";
import {ActivatedRoute, Router} from "@angular/router";
import {DialogService} from "../../dialog/dialog.service";

declare var google: any;

@Component({
    selector: 'app-add-route-map',
    encapsulation: ViewEncapsulation.None,
    templateUrl: './add-route-map.component.html',
    styleUrls: ['./add-route-map.component.css']
})
export class AddRouteMapComponent implements OnInit {

    public initLat: number;
    public initLong: number;
    public zoom = 15;
    public searchControl: FormControl= new FormControl();
    public selected: String = '';

    public mapPoints : any = [] ; //latLng array
    directions : any;

    private eventId: String;

   errors: Error[] = [];

    @ViewChild("search")
    public searchElementRef: ElementRef;

    constructor(private mapsAPILoader: MapsAPILoader, private ngZone: NgZone, private routeService: RouteService,
                private route: ActivatedRoute, private router: Router, private dialogService: DialogService) {}

    ngOnInit() {
      this.route.params.subscribe(params => {
        this.eventId = params['eventId'];
        console.log('[Route Management][OnInit]', this.eventId);
      });

      this.routeService.getRoute(this.eventId)
        .then(
          (route) => {
            console.log('[Route Management][OnInit][success]', route);
              this.mapPoints = route.coordinates as [{lat: number, lng: number}];
              this.selected = route.type;
            console.log('[Route Management][OnInit][Coordinates detected]', this.mapPoints);
            console.log('[Route Management][OnInit][Type Detected]', this.selected);
            this.initMap();
          }
        )
        .catch(
          (error) => {
            console.log('[Route Management][OnInit][error]', error);
            this.errors = error;
          }
        );


    }

    initMap(){

        //set up current location
      if(this.mapPoints.length > 0){
        this.initLat = this.mapPoints[0].lat;
        this.initLong = this.mapPoints[0].lng;
        if(this.selected === 'waypoints'){
          this.getRoutePointsAndWaypoints();
        }
      } else {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(position => {
            this.initLat = position.coords.latitude;
            this.initLong = position.coords.longitude;
            console.log("[Geolocated]", position.coords);
          });
        }
      }

        //add listener to Input search
        this.mapsAPILoader.load().then(()=> {
            let autocomplete = new google.maps.places.Autocomplete(this.searchElementRef.nativeElement, {
                types: ["address"]
            });
            autocomplete.addListener("place_changed", () => {
                this.ngZone.run(() => {
                    let place: google.maps.places.PlaceResult = autocomplete.getPlace();

                    if(place.geometry === undefined || place.geometry === null) {
                        return;
                    }
                    this.initLat= place.geometry.location.lat();
                    this.initLong= place.geometry.location.lng();
                    this.zoom = 17;

                    console.log("[Show area inserted]" + "[Lng]" +this.initLong + "[Lat]"+ this.initLong);
                })
            })
        });
    }


    mapClicked($event : AGMMouseEvent){

      if(this.selected === ''){
        this.dialogService.alert("Error", "You have to select a method to start draw the route !!!")
      }else {
        let currentpoint = $event.coords; //latLng literal coords
        console.log("[Map][Clicked][Coordinates detected]", currentpoint);
        this.mapPoints.push(currentpoint);
        this.initLat = this.mapPoints[this.mapPoints.length - 1].lat;
        this.initLong = this.mapPoints[this.mapPoints.length - 1].lng;
        if (this.selected === 'waypoints') {
          this.getRoutePointsAndWaypoints();
        }
      }
    }

    setRadio(value: String){
      this.selected = value;
      this.clearAll();
      console.log("[EditRoute][Selection]"+ this.selected);
    }

    getRoutePointsAndWaypoints(){
        let waypoints = [];
        if(this.mapPoints.length > 25){
          this.dialogService.alert("Error", "The maximum number of checkpoints is 23! If you want more than you can use 'Lines'.");
          return;
        }
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

    clearAll() {
      this.mapPoints = [];
      this.directions = null;
    }

    clearLast() {
      if(this.mapPoints.length> 1){
        this.mapPoints.pop();
        if(this.selected ==="waypoints"){
          this.getRoutePointsAndWaypoints();
        }
      } else {
          this.clearAll();
        }
    }

  /**
   * It is called when the user click the save route button.
   * It then calls the routeService to update the route passing the points.
   */
    saveRoute(){
      this.routeService.updateRoute(this.eventId, this.mapPoints, this.selected).then(()=> {
        this.dialogService.alert("Route", " The route is correctly saved.");
        this.router.navigate(['/events', this.eventId, 'manage']);
      }).catch((err) => {
        this.errors = err;
      });
    }
}

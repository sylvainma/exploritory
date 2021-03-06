L.mapbox.accessToken = "pk.eyJ1IjoiYnJ5bWNicmlkZSIsImEiOiJXN1NuOFFjIn0.3YNvR1YOvqEdeSsJDa-JUw";

var titleField, cluster, userFields = [], urlParams = {};

var mapboxOSM = L.tileLayer("https://{s}.tiles.mapbox.com/v4/mapbox.streets/{z}/{x}/{y}.png?access_token="+L.mapbox.accessToken, {
  maxZoom: 19,
  subdomains: ["a", "b", "c", "d"],
  attribution: 'Basemap <a href="https://www.mapbox.com/about/maps/" target="_blank">© Mapbox © OpenStreetMap</a>'
});

var mapboxSat = L.tileLayer("https://{s}.tiles.mapbox.com/v4/mapbox.streets-satellite/{z}/{x}/{y}.png?access_token="+L.mapbox.accessToken, {
  maxZoom: 19,
  subdomains: ["a", "b", "c", "d"],
  attribution: 'Basemap <a href="https://www.mapbox.com/about/maps/" target="_blank">© Mapbox © OpenStreetMap</a>'
});

var baseLayers = {
  "Street Map": mapboxOSM,
  "Aerial Imagery": mapboxSat
};

var markerClusters = new L.MarkerClusterGroup({
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  zoomToBoundsOnClick: true
});

var featureLayer = L.mapbox.featureLayer();

var showInfoImage = function(layer) {
  map.closePopup();
  var content = "";
  content += "<img align='center' src='"+ layer.feature.properties["url"] +"'/>";
  content += "<p><a href='http://flickr.com/photo.gne?id="+ layer.feature.properties["id"] +"'>See on Flickr</a></p>";
  content += "<table class='table table-striped table-bordered table-condensed'>";
  if (userFields.length > 0) {
    $.each(userFields, function(index, property) {
      if (layer.feature.properties[property]) {
        content += "<tr><th>" + property + "</th><td>" + formatProperty(layer.feature.properties[property]) + "</td></tr>";
      }
    });
  } else {
    $.each(layer.feature.properties, function(index, property) {
      if (property) {
        content += "<tr><th>" + index + "</th><td>" + formatProperty(property) + "</td></tr>";
      }
    });
  }
  content += "<table>";
  $("#feature-title").html(getTitle(layer));
  $("#feature-info").html(content);
  $("#featureModal").modal("show");
  $("#share-btn").click(function() {
    var link = location.toString() + "&id=" + L.stamp(layer);
    $("#share-hyperlink").attr("href", link);
    $("#share-twitter").attr("href", "https://twitter.com/intent/tweet?url=" + encodeURIComponent(link));
    $("#share-facebook").attr("href", "https://facebook.com/sharer.php?u=" + encodeURIComponent(link));
  });
};

featureLayer.on("ready", function(e) {

  // All Flickr images indices in the geojson
  var photos = [];
  featureLayer.eachLayer(function (layer) {
    photos.push({"id": layer.feature.properties.id, "properties": layer.feature.properties, "layer": layer});
  });
  
  // All pairs
  var pairs = [];
  for (var i = 0; i < photos.length - 1; i++) {
    for (var j = i+1; j < photos.length; j++) {
      pairs.push([photos[i], photos[j]]);
    }
  }

  // // Sort by proximity (closest photos will be annotated first)
  // pairs = pairs.sort(function (a, b) { 
  //   [p11, p12] = a;
  //   [p21, p22] = b;
  //   d_a = L.latLng(parseFloat(p11.properties.lat), parseFloat(p11.properties.lon)).distanceTo(
  //     L.latLng(parseFloat(p12.properties.lat), parseFloat(p12.properties.lon))
  //   );
  //   d_b = L.latLng(parseFloat(p21.properties.lat), parseFloat(p21.properties.lon)).distanceTo(
  //     L.latLng(parseFloat(p22.properties.lat), parseFloat(p22.properties.lon))
  //   );
  //   if (d_a < d_b) {
  //     // a comes first
  //     return -1;
  //   } else {
  //     return 1;
  //   }
  // });

  // Filter by distance: too far images should not be clustered together anyway
  pairs = pairs.filter(function(pair) {
    [p1, p2] = pair;
    d = L.latLng(parseFloat(p1.properties.lat), parseFloat(p1.properties.lon)).distanceTo(
      L.latLng(parseFloat(p2.properties.lat), parseFloat(p2.properties.lon))
    );
    return d <= 1000 // meters
  });

  // Random shuffle
  pairs = pairs.sort(function (a, b) { return 0.5 - Math.random() });

  // Initialize annotations
  var annotations = {}
  var currentPair = 0;

  // Show pairs
  var showPair = function () {
    [p1, p2] = pairs[currentPair];
    $(".current-pair").html(`${currentPair+1}/${pairs.length}`);
    $("#pair-photo").html(`
      <td><img class="pair-photo-preview" src="${p1.properties.url}" /></td>
      <td><img class="pair-photo-preview" src="${p2.properties.url}" /></td>
    `);
    $("#pair-annotation").html(`${currentPair in annotations ? "Already annotated <b>"+ annotations[currentPair][2] + "</b>" : ""}`);
    
    map.addLayer(p1.layer);
    map.addLayer(p2.layer);
    map.fitBounds([
      [p1.properties.lat, p1.properties.lon], 
      [p2.properties.lat, p2.properties.lon]]);
  }
  showPair(); // show first when page opens

  // When cluster label buttons are clicked
  $("#label-yes-btn").click(function() {
    [p1, p2] = pairs[currentPair];
    annotations[currentPair] = [p1.id, p2.id, 1];
    cleanPair();
    updateCurrentPair(+1);
    showPair();
  });
  $("#label-no-btn").click(function() {
    [p1, p2] = pairs[currentPair];
    annotations[currentPair] = [p1.id, p2.id, 0];
    cleanPair();
    updateCurrentPair(+1);
    showPair();
  });

  // When show buttons are clicked
  $(".photo-info-btn").click(function() {
    [p1, p2] = pairs[currentPair];
    if ($(this).attr("photo") == 1){
      showInfoImage(p1.layer);
    } else {
      showInfoImage(p2.layer);
    }
  });

  // Clean pair when prev/next is clicked
  var cleanPair = function() {
    [p1, p2] = pairs[currentPair];
    map.removeLayer(p1.layer);
    map.removeLayer(p2.layer);
  }

  // Next/Prev limits
  var updateCurrentPair = function(delta) {
    currentPair += delta;
    currentPair = Math.max(0, currentPair);
    currentPair = Math.min(pairs.length, currentPair);
    if (currentPair == pairs.length-1){
      $("#next-btn").prop('disabled', true);
    } else {
      $("#next-btn").prop('disabled', false);
    }
    if (currentPair == 0){
      $("#prev-btn").prop('disabled', true);
    } else {
      $("#prev-btn").prop('disabled', false);
    }
  }

  // Click events on prev/next
  $("#prev-btn").click(function() {
    cleanPair();
    updateCurrentPair(-1);
    showPair();
  });
  $("#next-btn").click(function() {
    cleanPair()
    updateCurrentPair(+1);
    showPair();
  });

  // When markers are clicked 
  featureLayer.eachLayer(function (layer) {
    layer.on("click", function (e) {
      showInfoImage(e.target);
    });
  });

  // Download
  $("#download").click(function() {
    var csv = "id1,id2,together\n";
    csv += Object.keys(annotations).map(function(k){
      return annotations[k].join();
    }).join('\n');
    $("#download").attr("href", 'data:text/csv;charset=utf-8,' + encodeURI(csv));
    $("#download").attr("download", "annotations_"+ Date.now());
  });

  // // Upload
  // $("#upload_link").on('click', function(e){
  //     e.preventDefault();
  //     $("#upload_input:hidden").trigger('click');
  // });
  // var uploadFun = function() {
  //   var csv = $('#upload_input');
  //   var csvFile = csv[0].files[0];
  //   var ext = csv.val().split(".").pop().toLowerCase();

  //   // If input file is not a CSV
  //   if($.inArray(ext, ["csv"]) === -1){
  //     alert("You must upload a CSV file");
  //       return false;
  //   }
  //   // If correctly uploaded, start to read
  //   if(csvFile != undefined){
  //       reader = new FileReader();
  //       reader.onload = function(e){
  //         csvResult = e.target.result.split(/\r|\n|\r\n/);
  //         // Every row is saved into csvResult as an array
  //         console.log(csvResult);
  //       }
  //       reader.readAsText(csvFile);
  //   }
  // };
  // document.getElementById('upload_input').addEventListener('change', uploadFun);

});

// Ask to download the CSV before leaving
// var canLeave = false;
// window.onbeforeunload = function (e) {
//   if (canLeave) return null
//   e = e || window.event;
//   var msg = "You haven't downloaded your annotations, are you sure you want to leave?";
//   // For IE and Firefox prior to version 4
//     if (e) {
//       e.returnValue = msg;
//   }
//   // For Safari
//   return msg;
// };

featureLayer.once("ready", function(e) {});

var map = L.map("map", {
  zoom: 10,
  layers: [mapboxOSM]
}).fitWorld();
map.attributionControl.setPrefix("");

var layerControl = L.control.layers(baseLayers, null, {
  collapsed: document.body.clientWidth <= 767 ? true : false
}).addTo(map);

var locateControl = L.control.locate({
  drawCircle: true,
  follow: true,
  setView: true,
  keepCurrentZoomLevel: false,
  markerStyle: {
    weight: 1,
    opacity: 0.8,
    fillOpacity: 0.8
  },
  circleStyle: {
    weight: 1,
    clickable: false
  },
  icon: "fa fa-crosshairs",
  metric: false,
  strings: {
    title: "My location",
    popup: "You are within {distance} {unit} from this point",
    outsideMapBoundsMsg: "You seem located outside the boundaries of the map"
  },
  locateOptions: {
    maxZoom: 18,
    watch: true,
    enableHighAccuracy: true,
    maximumAge: 10000,
    timeout: 10000
  }
}).addTo(map);

function fetchDataLocally() {
  $("#loading").show();
  featureLayer.clearLayers();
  featureLayer.loadURL(decodeURIComponent("data.geojson")).on("ready", function(layer) {
    $("#loading").hide();
  });
}

function fetchData() {
  return fetchDataLocally();
}

function getTitle(layer) {
  if (urlParams.title_field) {
      titleField = decodeURI(urlParams.title_field);
  }
  if (titleField && layer.feature.properties[titleField]) {
    return layer.feature.properties[titleField];
  }
  else {
    if ("title" in layer.feature.properties) {
      return layer.feature.properties["title"];
    }
    else {
      if (userFields.length > 0) {
        return layer.feature.properties[userFields[0]];
      }
      else {
        return layer.feature.properties[Object.keys(layer.feature.properties)[0]];
      }
    }
  }
}

function formatProperty(value) {
  if (typeof value == "string" && (value.indexOf("http") === 0 || value.indexOf("https") === 0)) {
    return "<a href='" + value + "' target='_blank'>" + value + "</a>";
  } else {
    return value;
  }
}

function zoomToFeature(id) {
  var layer = featureLayer.getLayer(id);
  if (layer instanceof L.Marker) {
    map.setView([layer.getLatLng().lat, layer.getLatLng().lng], 17);
  }
  else {
    map.fitBounds(layer.getBounds());
  }
  layer.fire("click");
  /* Hide sidebar and go to the map on small screens */
  if (document.body.clientWidth <= 767) {
    $("#sidebar").hide();
    map.invalidateSize();
  }
}

if (location.search) {
  var parts = location.search.substring(1).split("&");
  for (var i = 0; i < parts.length; i++) {
    var nv = parts[i].split("=");
    if (!nv[0]) continue;
    urlParams[nv[0]] = nv[1] || true;
  }
}

if (urlParams.fields) {
  fields = urlParams.fields.split(",");
  $.each(fields, function(index, field) {
    field = decodeURI(field);
    userFields.push(field);
  });
}

if (urlParams.cluster && (urlParams.cluster === "false" || urlParams.cluster === "False" || urlParams.cluster === "0")) {
  cluster = false;
} else {
  cluster = false;
}

if (urlParams.attribution) {
  var attribution = decodeURI(urlParams.attribution);
  map.attributionControl.setPrefix(attribution);
}

if (cluster === true) {
  //map.addLayer(markerClusters);
  layerControl.addOverlay(markerClusters, "<span name='title'>GeoJSON Data</span>");
} else {
  //map.addLayer(featureLayer);
  layerControl.addOverlay(featureLayer, "<span name='title'>GeoJSON Data</span>");
}

$("#full-extent-btn").click(function() {
  map.fitBounds(featureLayer.getBounds());
  $(".navbar-collapse.in").collapse("hide");
  return false;
});

$("#list-btn").click(function() {
  $("#sidebar").toggle();
  map.invalidateSize();
  return false;
});

$("#nav-btn").click(function() {
  $(".navbar-collapse").collapse("toggle");
  return false;
});

$("#sidebar-toggle-btn").click(function() {
  $("#sidebar").toggle();
  map.invalidateSize();
  return false;
});

$("#sidebar-hide-btn").click(function() {
  $("#sidebar").hide();
  map.invalidateSize();
});

$(document).ready(function() {
  fetchData();
});

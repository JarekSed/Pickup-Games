// Copyright 2016, Google, Inc.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

$(function(){
  // This is the host for the backend.
  // TODO: When running locally, set to http://localhost:8081. Before
  // deploying the application to a live production environment, change to
  // https://backend-dot-<PROJECT_ID>.appspot.com as specified in the
  // backend's app.yaml file.

  var backendHostUrl = 'https://backend-dot-pickup-basketball.appspot.com';
  //var backendHostUrl = 'http://jsedlacek.info:8081';

  // Initialize Firebase
  var config = {
    apiKey: "AIzaSyC-EgXgmN6htOBfhwQJ509Ef967SWm4v7w",
    authDomain: "pickup-basketball.firebaseapp.com",
    databaseURL: "https://<DATABASE_NAME>.firebaseio.com",
    storageBucket: "<BUCKET>.appspot.com",
  };

  // This is passed into the backend to authenticate the user.
  var userIdToken = null;
	var userName = null;
  // Firebase log-in
  function configureFirebaseLogin() {

    firebase.initializeApp(config);

    firebase.auth().onAuthStateChanged(function(user) {
      if (user) {
        $('#logged-out').hide();
        var name = user.displayName;

        /* If the provider gives a display name, use the name for the
        personal welcome message. Otherwise, use the user's email. */
        userName = name ? name : user.email;

        user.getToken().then(function(idToken) {
          userIdToken = idToken;

          /* Now that the user is authenicated, fetch the games. */
          fetchGames();

          $('#user').text(userName);
          $('#logged-in').show();

        });

      } else {
        $('#logged-in').hide();
        $('#logged-out').show();

      }

    });

  }

  // Firebase log-in widget
  function configureFirebaseLoginWidget() {
    var uiConfig = {
      'signInSuccessUrl': '/',
      'signInOptions': [
        // Leave the lines as is for the providers you want to offer your users.
        firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        firebase.auth.FacebookAuthProvider.PROVIDER_ID,
        firebase.auth.EmailAuthProvider.PROVIDER_ID
      ],
      // Terms of service url
      //'tosUrl': '<your-tos-url>',
    };

    var ui = new firebaseui.auth.AuthUI(firebase.auth());
    ui.start('#firebaseui-auth-container', uiConfig);
  }

  // Fetch games from the backend.
  function fetchGames() {
    $.ajax(backendHostUrl + '/games', {
      /* Set header for the XMLHttpRequest to get data from the web server
      associated with userIdToken */
      headers: {
        'Authorization': 'Bearer ' + userIdToken
      }
    }).then(function(data){
      $('#games-container').empty();
      // Iterate over user data to display games from database.
      data.forEach(function(game){
        var $wrapper = $("<div/>", { class: "game" });
        $text = "Created: " + game.created + " by " + game.creator + "<br/> Registered Players: <table>"
        game.players.forEach(function(player){
          $text += "<tr><td>" + player.id + "</td></tr>"
        });
        $text += "</table>"
        $wrapper.append($('<p>')).html("<h2>"+ game.date + " -- " + game.location +"</h2>"+$text);
        $('#games-container').append($wrapper);

      	// Create button to delete this game.
				$deleteBtn= $('<button/>').text('Delete this game');
        $deleteBtn.addClass("ui-button ui-corner-all ui-widget");
			  $wrapper.append($deleteBtn);
				$deleteBtn.click(function(event) {
					event.preventDefault();
          if ( confirm('Are you sure you want to delete this game? This cannot be undone!')) {
            $.ajax(backendHostUrl + '/delete_game', {
              headers: {
                'Authorization': 'Bearer ' + userIdToken
              },
              method: 'POST',
              data: JSON.stringify({'game_id': game.id}),
              contentType : 'application/json',
              error :  function(_, textStatus, errorThrown ) {
                alert('Error: ' + textStatus + ': ' + errorThrown);
              },
              success : function (_, _, _) {
                alert('Game deleted');
              }
            }).then(function(){
              // Refresh games list.
              fetchGames();
            });
          }
				});


				// Create button to register for this game.
				$registerBtn = $('<button/>').text('Register');
        $registerBtn.addClass("ui-button ui-corner-all ui-widget");
			  $wrapper.append($registerBtn);
				$registerBtn.click(function(event) {
					event.preventDefault();
					$.ajax(backendHostUrl + '/register', {
						headers: {
							'Authorization': 'Bearer ' + userIdToken
						},
						method: 'POST',
            error :  function(_, textStatus, errorThrown ) {
              alert('Error: ' + textStatus + ': ' + errorThrown);
            },
						data: JSON.stringify({'game_id': game.id, 'player_id': userName}),
						contentType : 'application/json'
					}).then(function(){
						// Refresh games list.
						fetchGames();
    			});
				});
				// Create button to unregister for this game.
				$unRegisterBtn = $('<button/>').text('Unregister');
        $unRegisterBtn.addClass("ui-button ui-corner-all ui-widget");
			  $wrapper.append($unRegisterBtn);
				$unRegisterBtn.click(function(event) {
					event.preventDefault();
					$.ajax(backendHostUrl + '/unregister', {
						headers: {
							'Authorization': 'Bearer ' + userIdToken
						},
						method: 'POST',
            error :  function(_, textStatus, errorThrown ) {
              alert('Error: ' + textStatus + ': ' + errorThrown);
            },
						data: JSON.stringify({'game_id': game.id, 'player_id': userName}),
						contentType : 'application/json'
					}).then(function(){
						// Refresh games list.
						fetchGames();
    			});
				});


      });
    });
  }

  // Sign out a user
  var signOutBtn =$('#sign-out');
  signOutBtn.click(function(event) {
    event.preventDefault();

    firebase.auth().signOut().then(function() {
      console.log("Sign out successful");
    }, function(error) {
      console.log(error);
    });
  });

	// Create game functions
  gameLocation = $( "#location" ),
  date = $( "#datetimepicker" ),
  allFields = $( [] ).add( gameLocation).add( date),
  tips = $( ".validateTips" );

	function updateTips( t ) {
		tips
			.text( t )
			.addClass( "ui-state-highlight" );
		setTimeout(function() {
				tips.removeClass( "ui-state-highlight", 1500 );
				}, 500 );
	}

	function checkEmpty( o, n) {
		if ( o.val().length <= 0 ) {
			o.addClass( "ui-state-error" );
			updateTips( n + " must be set.");
			return false;
		} else {
			return true;
		}
	}


	function addGame() {
		var valid = true;
		allFields.removeClass( "ui-state-error" );

		valid = valid && checkEmpty( gameLocation, "Location");
		valid = valid && checkEmpty( date, "Date and Time");

		if ( valid ) {
			$.ajax(backendHostUrl + '/add_game', {
      headers: {
        'Authorization': 'Bearer ' + userIdToken
      },
      method: 'POST',
      error :  function(_, textStatus, errorThrown ) {
        alert('Error: ' + textStatus + ': ' + errorThrown);
      },
      data: JSON.stringify({'location': gameLocation.val(), 'date': date.val()}),
      contentType : 'application/json'
			}).then(function(){
				// Refresh games list.
				fetchGames();
			});
			dialog.dialog( "close" );
      fetchGames()
		}
		return valid;
	}

	dialog = $( "#dialog-form" ).dialog({
      autoOpen: false,
      height: 400,
      width: 350,
      modal: true,
      buttons: {
        "Create a game": addGame,
        Cancel: function() {
          dialog.dialog( "close" );
        }
      },
      close: function() {
        form[ 0 ].reset();
        allFields.removeClass( "ui-state-error" );
      }
    });

    form = dialog.find( "form" ).on( "submit", function( event ) {
      event.preventDefault();
      addGame();
    });

    $( "#add-game" ).button().on( "click", function() {
      dialog.dialog( "open" );
	    return false;
    });

  configureFirebaseLogin();
  configureFirebaseLoginWidget();
	$('#datetimepicker').datetimepicker({
		format:'d M Y h:i a',
		step: 30,
	});

});

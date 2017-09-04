# Copyright 2016 Google Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from datetime import datetime
import logging

from flask import Flask
from flask import jsonify
from flask import  request
import flask_cors
import requests_toolbelt.adapters.appengine

from google.appengine.ext import ndb
import google.auth.transport.requests
import google.oauth2.id_token

# Use the App Engine Requests adapter. This makes sure that Requests uses
# URLFetch.
requests_toolbelt.adapters.appengine.monkeypatch()
HTTP_REQUEST = google.auth.transport.requests.Request()

app = Flask(__name__)
flask_cors.CORS(app)


class Game(ndb.Model):
  """NDB model for a scheduled pickup game."""
  location = ndb.StringProperty()
  creator = ndb.StringProperty()
  date = ndb.DateTimeProperty()
  created = ndb.DateTimeProperty(auto_now_add=True)


class Signup(ndb.Model):
  """NDB model for a scheduled pickup game."""
  game_id = ndb.IntegerProperty()
  player_id = ndb.StringProperty()
  created = ndb.DateTimeProperty(auto_now_add=True)


def get_all_games():
  """Fetches all games.

  Games are ordered them by date created, with the oldest game last.
  first.

  Returns: List of all games found.
  """
  query = Game.query().order(-Game.created)
  games = query.fetch()
  all_games = []
  for g in games:
    players = Signup.query(Signup.game_id == g.key.id()).order(Signup.created)
    all_games.append({'date': g.date,
                      'location': g.location,
                      'created': g.created,
                      'id': g.key.id(),
                      'creator': g.creator,
                      'players': [{'id': p.player_id} for p in players]})
  return all_games


@app.route('/games', methods=['GET'])
def list_games():
  """Returns a list of games."""

  # Verify Firebase auth.
  id_token = request.headers['Authorization'].split(' ').pop()
  claims = google.oauth2.id_token.verify_firebase_token(
      id_token, HTTP_REQUEST)
  if not claims:
    return 'Unauthorized', 401

  games = get_all_games()

  return jsonify(games)


@app.route('/unregister', methods=['POST', 'PUT'])
def unregister_from_game():
  """Unregisters a user for a game.

  The request should be in this format:
      {
          "game_id": 123456,
          "player_id": "Jarek Sedlacek",

      }
  """

  # Verify Firebase auth.
  id_token = request.headers['Authorization'].split(' ').pop()
  claims = google.oauth2.id_token.verify_firebase_token(
      id_token, HTTP_REQUEST)
  if not claims:
    return 'Unauthorized', 401

  data = request.get_json()
  if data['player_id'] != claims['name']:
    return 'Form user was {} but authenticated user was {}'.format(
        data['player_id'], claims['name']), 401

  # If already registered, ignore this request.
  query = Signup.query(Signup.player_id == data['player_id'],
                       Signup.game_id == data['game_id'])
  signups = query.fetch()
  for signup in signups:
    signup.key.delete()
  return 'OK', 200


@app.route('/register', methods=['POST', 'PUT'])
def register_for_game():
  """Registers a user for a game.

  The request should be in this format:

    {
        "game_id": 123456,
        "player_id": "Jarek Sedlacek",

    }
  """
  # Verify Firebase auth.
  id_token = request.headers['Authorization'].split(' ').pop()
  claims = google.oauth2.id_token.verify_firebase_token(
      id_token, HTTP_REQUEST)
  if not claims:
    return 'Unauthorized', 401

  data = request.get_json()
  if data['player_id'] != claims['name']:
    return 'Form user was {} but authenticated user was {}'.format(
        data['player_id'], claims['name']), 401

  # If already registered, ignore this request.
  query = Signup.query(Signup.player_id == data['player_id'],
                       Signup.game_id == data['game_id'])
  found = query.fetch()
  if found:
    return 'OK', 200

  # Populates note properties according to the model,
  # with the user ID as the key name.
  signup = Signup(
      player_id=data['player_id'],
      game_id=data['game_id'])

  signup.put()

  return 'OK', 200


@app.route('/add_game', methods=['POST', 'PUT'])
def add_game():
  """Adds a game.

  The request should be in this format:

      {
          "location": "that one building.",
          "date": "Jun 1 2017 9:24PM",

      }
  """
  # Verify Firebase auth.
  id_token = request.headers['Authorization'].split(' ').pop()
  claims = google.oauth2.id_token.verify_firebase_token(
      id_token, HTTP_REQUEST)
  if not claims:
    return 'Unauthorized', 401

  data = request.get_json()
  date = datetime.strptime(data['date'], '%d %b %Y %I:%M %p')
  game = Game(
      location=data['location'],
      date=date,
      creator=claims['name'])

  game.put()

  return 'OK', 200


@app.route('/delete_game', methods=['POST', 'PUT', 'DELETE'])
def delete_game():
  """Deletes a game.

  The request should be in this format:

      {
          "game_id": 123456
      }
  """
  # Verify Firebase auth.
  id_token = request.headers['Authorization'].split(' ').pop()
  claims = google.oauth2.id_token.verify_firebase_token(
      id_token, HTTP_REQUEST)
  if not claims:
    return 'Unauthorized', 401
  data = request.get_json()

  # Fetch game to delete
  game = Game.get_by_id(data['game_id'])

  if not game:
    return 'No game with id {} found'.format(data['game_id']), 401
  if game.creator != claims['name']:
    return 'Game was created by {} but delete request came from {}'.format(
        game.creator, claims['name']), 401
  game.key.delete()
  return 'OK', 200


@app.errorhandler(500)
def server_error(_):
  # Log the error and stacktrace.
  logging.exception('An error occurred during a request.')
  return 'An internal error occurred.', 500

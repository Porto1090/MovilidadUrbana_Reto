# TC2008B. Sistemas Multiagentes y Gráficas Computacionales
# Python flask server to interact with webGL.
# Octavio Navarro. 2024

from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
from randomAgents.model import TrafficModel
from randomAgents.agent import CarAgent, TrafficLightAgent, RoadAgent, BuildingAgent, DestinationAgent

trafficModel = None
currentStep = 0

# This application will be used to interact with WebGL
app = Flask("Traffic example")
cors = CORS(app, origins=['http://localhost'])

# This route will be used to send the parameters of the simulation to the server.
# The servers expects a POST request with the parameters in a.json.
@app.route('/init', methods=['POST'])
@cross_origin()
def initModel():
    global trafficModel

    if request.method == 'POST':
        try:
            # Obtén los datos del mapa desde la solicitud JSON
            map_file = request.json.get('mapFile')
            map_dict = request.json.get('mapDict')
            
            # Asegúrate de que ambos valores no sean None
            if not map_file or not map_dict:
                raise ValueError("Missing mapFile or mapDict in request.")

            # Inicializa el modelo
            trafficModel = TrafficModel(map_file, map_dict)

            # Verifica si la inicialización fue exitosa
            if trafficModel is None:
                raise ValueError("Failed to initialize trafficModel.")

            # Devuelve un mensaje de éxito con el tamaño del mapa
            print(f"Model initialized with width {trafficModel.width} and height {trafficModel.height}")
            return jsonify({"message": "Model initialized", "width": trafficModel.width, "height": trafficModel.height})

        except Exception as e:
            # Si ocurre un error, devuelve un mensaje con la descripción del error
            return jsonify({"error": str(e)}), 500



# This route will be used to get the positions of the agents
@app.route('/getAgents', methods=['GET'])
@cross_origin()
def getAgents():
    global trafficModel

    if request.method == 'GET':
        # Get the positions of the agents and return them to WebGL in JSON.json.t.
        # Note that the positions are sent as a list of dictionaries, where each dictionary has the id and position of an agent.
        # The y coordinate is set to 1, since the agents are in a 3D world. The z coordinate corresponds to the row (y coordinate) of the grid in mesa.
        try:
            #{'agentPositions':agentPositions, 'lightPositions':lightPositions}
            agentPositions = []
            lightPositions = []

            agentPositions = [
                {"id": str(a.unique_id), "x": x, "y":1, "z":z}
                for agents, (x, z) in trafficModel.grid.coord_iter()
                for a in agents
                if isinstance(a, CarAgent)
            ]
            lightPositions = [
                {"id": str(a.unique_id), "x": x, "y":1, "z":z, "orientation": a.orientation, "state": a.state}
                for agents, (x, z) in trafficModel.grid.coord_iter()
                for a in agents
                if isinstance(a, TrafficLightAgent)
            ]

            return jsonify({'agentPositions':agentPositions, 'lightPositions':lightPositions})
        except Exception as e:
            print(e)
            return jsonify({"message":"Error with the agent positions"}), 500
        
# This route will be used to get the positions of every static agent (environment)
@app.route('/environment', methods=['GET'])
@cross_origin()
def getEnvironment():
    global trafficModel

    if request.method == 'GET':
        try:
            environmentPosition = {
                'road': [],
                'building': [],
                'destination': [],
            }

            for agents, (x, z) in trafficModel.grid.coord_iter():
                for a in agents:  # Iterar sobre cada agente en la celda MULTIGRID
                    if isinstance(a, RoadAgent):
                        environmentPosition['road'].append({"id": str(a.unique_id), "x": x, "y":1, "z":z, "direction": a.direction})
                    elif isinstance(a, BuildingAgent):
                        environmentPosition['building'].append({"id": str(a.unique_id), "x": x, "y":1, "z":z})
                    elif isinstance(a, DestinationAgent):
                        environmentPosition['destination'].append({"id": str(a.unique_id), "x": x, "y":1, "z":z})
                        
            return jsonify({'positions':environmentPosition})
        except Exception as e:
            print(e)
            return jsonify({"message":"Error with environment positions"}), 500

# This route will be used to update the model
@app.route('/update', methods=['GET'])
@cross_origin()
def updateModel():
    global currentStep, trafficModel
    if request.method == 'GET':
        try:
        # Update the model and return a message to WebGL saying that the model was updated successfully
            trafficModel.step()
            currentStep += 1
            return jsonify({'message':f'Model updated to step {currentStep}.', 'currentStep':currentStep})
        except Exception as e:
            print(e)
            return jsonify({"message":"Error during step."}), 500


if __name__=='__main__':
    # Run the flask server in port 8585
    app.run(host="localhost", port=8585, debug=True)

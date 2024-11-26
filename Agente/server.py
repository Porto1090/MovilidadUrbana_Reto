# server.py
from mesa.visualization.modules import CanvasGrid, TextElement
from mesa.visualization.ModularVisualization import ModularServer
from model import TrafficModel
from agent import (CarAgent, ObstacleAgent, 
                  DestinationAgent, TrafficLightAgent, RoadAgent)

class SimulationStats(TextElement):
    """Display simulation statistics"""
    def render(self, model):
        stats = {
            "Active Cars": len(model.active_cars),
            "Total Cars Created": model.cars_created,
            "Traffic Density": f"{model.get_traffic_density():.2f}%"
        }
        return "<br>".join(f"{k}: {v}" for k, v in stats.items())

def agent_portrayal(agent):
    """Define how to portray each agent type in the visualization"""
    portrayal = {
        "Shape": "rect",
        "Filled": True,
        "Layer": 0,
        "w": 0.9,
        "h": 0.9,
        "text": "",
        "text_color": "black"
    }
    
    if isinstance(agent, CarAgent):
        portrayal.update({
            "Shape": "circle",
            "Color": "blue",
            "Layer": 1,
            "r": 0.8,
            "text": "🚗"
        })

    elif isinstance(agent, ObstacleAgent):
        portrayal.update({
            "Color": "#404040",
            "text": "⬛"
        })
    elif isinstance(agent, DestinationAgent):
        portrayal.update({
            "Color": "#90EE90",
            "text": "🎯"
        })
    elif isinstance(agent, TrafficLightAgent):
        color = "#50C878" if agent.state == "green" else "#FF4433"
        portrayal.update({
            "Color": color,
            "Layer": 2,
            "text": "🚦"
        })
    elif isinstance(agent, RoadAgent):
        direction_arrows = {
            "right": "→",
            "left": "←",
            "up": "↑",
            "down": "↓"
        }
        portrayal.update({
            "Color": "#D3D3D3",
            "text": direction_arrows.get(agent.direction, ""),
            "text_color": "black"
        })
    
    return portrayal

def create_server(map_file="public/2022_base.txt", map_dict="public/mapDictionary.json"):
    # Calculate grid size from map file
    with open(map_file, 'r') as f:
        map_data = f.read().strip().split('\n')
    height = len(map_data) + 1
    width = len(map_data[0]) + 1
    
    # Create visualization elements
    grid = CanvasGrid(agent_portrayal, width, height, width * 25, height * 25)
    stats = SimulationStats()
    
    # Create server
    server = ModularServer(
        TrafficModel,
        [grid, stats],
        "Traffic Simulation",
        {
            "map_file_path": map_file, 
            "map_dict_path": map_dict
        }
    )
    
    return server

if __name__ == "__main__":
    server = create_server()
    server.port = 8521
    server.launch()
from mesa import Model, agent
from mesa.time import RandomActivation
from mesa.space import MultiGrid
from .agent import CarAgent, RoadAgent, TrafficLightAgent, BuildingAgent, DestinationAgent
import json

class TrafficModel(Model):
    """Traffic model based on a map file"""
    def __init__(self, map_file_path: str, map_dict_path: str):
        super().__init__()
        self.car_id = 1000
        self.step_count = 0
        self.spawn_frequency = 10
        self.available_destinations = []

        try:
            with open(map_file_path, 'r') as f:
                self.map_data = f.read().strip().split('\n')
        except Exception as e:
            raise ValueError(f"Error reading map file: {e}")

        try:
            with open(map_dict_path, 'r') as f:
                self.map_dictionary = json.load(f)
        except Exception as e:
            raise ValueError(f"Error reading map dictionary file: {e}")

        self.height = len(self.map_data)
        self.width = len(self.map_data[0])

        self.grid = MultiGrid(self.width, self.height, False)
        self.schedule = RandomActivation(self)

        self.initialize_map()
        self.add_car()
        self.running = True


    def initialize_map(self):
        """Inicializa el mapa con todos los agentes estáticos"""
        agent_id = 0
        
        for y in range(self.height):
            for x in range(self.width):
                char = self.map_data[y][x]
                agent = None

                if char in self.map_dictionary:
                    agent_type = self.map_dictionary[char]
                    if agent_type in ["Right", "Left", "Up", "Down"]:
                        agent = RoadAgent(f"road_{agent_id}", self, agent_type.lower())
                    elif agent_type in ["Horizontal TrafficLight", "Vertical TrafficLight"]:
                        orientation = "horizontal" if agent_type == "Horizontal TrafficLight" else "vertical"
                        agent = TrafficLightAgent(f"light_{agent_id}", self, orientation)
                    elif agent_type == "Obstacle":
                        agent = BuildingAgent(f"build_{agent_id}", self)
                    elif agent_type == "Destination":
                        agent = DestinationAgent(f"dest_{agent_id}", self)
                        self.available_destinations.append((x, y))
                
                if agent:
                    # Coloca el agente en la celda (x, y)
                    self.grid.place_agent(agent, (x, y))
                    self.schedule.add(agent)
                    agent_id += 1


    def add_car(self):
        """Add cars to random valid starting positions"""
        corners = [(0, 0), (self.width-1, 0), (0, self.height-1), (self.width-1, self.height-1)]
        for corner in corners:
            car = CarAgent(f"car_{self.car_id}", self)
            self.car_id += 1
            cell_contents = self.grid.get_cell_list_contents(corner)

            if any(isinstance(agent, RoadAgent) for agent in cell_contents):
                self.grid.place_agent(car, corner)
                self.schedule.add(car)

    def remove_agent(self, agent):
        """Remove an agent from the model"""
        self.grid.remove_agent(agent)
        self.schedule.remove(agent)

    def step(self):
        '''Advance the model by one step.'''
        self.step_count += 1
        if self.step_count % self.spawn_frequency == 0:
            self.add_car()
        self.schedule.step()

from mesa import Model, agent
from mesa.time import RandomActivation
from mesa.space import SingleGrid
from .agent import CarAgent, RoadAgent, TrafficLightAgent, ObstacleAgent, BuildingAgent, DestinationAgent
import json

class TrafficModel(Model):
    """Traffic model based on a map file"""
    def __init__(self, map_file_path: str, map_dict_path: str):
        super().__init__()
        
        with open(map_file_path, 'r') as f:
            self.map_data = f.read().strip().split('\n')
        
        with open(map_dict_path, 'r') as f:
            self.map_dictionary = json.load(f)
        
        # Set grid size based on map and for border
        self.height = len(self.map_data) + 1 
        self.width = len(self.map_data[0]) + 1

        self.grid = SingleGrid(self.width, self.height, False)
        self.schedule = RandomActivation(self)
        
        # Creates the border of the grid
        border = [(x,y) for y in range(self.height) for x in range(self.width) if y in [0, self.height-1] or x in [0, self.width - 1]]

        # Add obstacles to the grid
        for i, pos in enumerate(border):
            obs = ObstacleAgent(f"o-{i+1000}",self)
            self.grid.place_agent(obs, pos)
        
        # Initialize map
        self.initialize_map()
        
        # Add some cars
        self.num_cars = 5 # por el momento
        #self.add_cars()
        
        self.running = True

    def initialize_map(self):
        """Initialize the map with all static agents"""
        agent_id = 0
        
        # Iterate over the valid area within the border
        for y in range(1, self.height - 1):
            for x in range(1, self.width - 1):
                char = self.map_data[y - 1][x - 1]
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
                
                if agent:
                    # Colocar el agente en la posición válida dentro del borde
                    self.grid.place_agent(agent, (x, y))
                    self.schedule.add(agent)
                    agent_id += 1

    def add_cars(self):
        """Add cars to random valid starting positions"""
        for i in range(self.num_cars):
            car = CarAgent(f"car_{i}", self)
            # Find valid starting position (with a direction arrow)
            while True:
                x = self.random.randrange(self.width)
                y = self.random.randrange(self.height)
                cell_contents = self.grid.get_cell_list_contents((x, y))
                if any(isinstance(agent, RoadAgent) for agent in cell_contents):
                    self.grid.place_agent(car, (x, y))
                    self.schedule.add(car)
                    break

    def step(self):
        '''Advance the model by one step.'''
        self.schedule.step()

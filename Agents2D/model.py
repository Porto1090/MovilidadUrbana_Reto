# model.py
from mesa import Model
from mesa.time import RandomActivation
from mesa.space import MultiGrid  # Cambiado de SingleGrid a MultiGrid
from agent import (CarAgent, RoadAgent, TrafficLightAgent, 
                 BuildingAgent, DestinationAgent)
import json
import random

class TrafficModel(Model):
    def __init__(self, map_file_path: str, map_dict_path: str):
        super().__init__()
        
        # Load map data and flip it vertically to match visualization
        with open(map_file_path, 'r') as f:
            self.map_data = f.read().strip().split('\n')
            # Flip the map vertically
            self.map_data = self.map_data[::-1]
        
        with open(map_dict_path, 'r') as f:
            self.map_dictionary = json.load(f)
        
        self.height = len(self.map_data)
        self.width = len(self.map_data[0])
        
        self.grid = MultiGrid(self.width, self.height, False)
        self.schedule = RandomActivation(self)
        
        # Tracking variables
        self.step_count = 0
        self.cars_created = 0
        self.spawn_frequency = 10
        self.total_wait_time = 0
        self.wait_time_counts = 0
        
        # Lists for tracking
        self.active_cars = []
        self.available_destinations = []
        self.spawn_points = []
        self.traffic_lights = []
        self.road_cells = {}
        
        # Traffic light groups for controlling them together
        self.traffic_light_groups = {
            "horizontal": [],
            "vertical": []
        }

        # Initialize the map
        self.initialize_map()
        self.running = True

    def initialize_map(self):
        """Initialize the map with all static agents"""
        agent_id = 0
        
        for y in range(self.height):
            for x in range(self.width):
                char = self.map_data[y][x]
                
                # Create road agents for directional cells
                if char in ['>', '<', '^', 'v']:
                    direction_map = {
                        '>': 'right',
                        '<': 'left',
                        '^': 'up',
                        'v': 'down'
                    }
                    road_agent = RoadAgent(f"road_{agent_id}", self, direction_map[char])
                    self.place_agent(road_agent, x, y)
                    self.road_cells[(x, y)] = direction_map[char]
                    agent_id += 1
                    
                    # Add spawn points at the edges
                    if x in [0, self.width-1] or y in [0, self.height-1]:
                        self.spawn_points.append((x, y))
                
                elif char == '#':
                    building = BuildingAgent(f"building_{agent_id}", self)
                    self.place_agent(building, x, y)
                    agent_id += 1
                
                elif char in ['S', 's']:
                    # First place a road agent with appropriate direction
                    if char == 'S':  # Horizontal traffic light
                        road_directions = ['right', 'left']
                        for direction in road_directions:
                            road_agent = RoadAgent(f"road_{agent_id}", self, direction)
                            self.place_agent(road_agent, x, y)
                            agent_id += 1
                    else:  # Vertical traffic light
                        road_directions = ['up', 'down']
                        for direction in road_directions:
                            road_agent = RoadAgent(f"road_{agent_id}", self, direction)
                            self.place_agent(road_agent, x, y)
                            agent_id += 1
                    
                    # Then place the traffic light
                    orientation = "horizontal" if char == 'S' else "vertical"
                    traffic_light = TrafficLightAgent(f"light_{agent_id}", self, orientation)
                    self.traffic_lights.append(traffic_light)
                    # Agregar al grupo correspondiente
                    self.traffic_light_groups[orientation].append(traffic_light)
                    self.place_agent(traffic_light, x, y)
                    agent_id += 1
                
                elif char == 'D':
                    destination = DestinationAgent(f"dest_{agent_id}", self)
                    self.available_destinations.append((x, y))
                    self.place_agent(destination, x, y)
                    agent_id += 1

    def create_border(self):
        """Creates building around the border of the grid"""
        # Create top and bottom borders
        for x in range(self.width):
            # Top border
            building = BuildingAgent(f"border_top_{x}", self)
            self.grid.place_agent(building, (x, 0))
            self.schedule.add(building)
            
            # Bottom border
            building = BuildingAgent(f"border_bottom_{x}", self)
            self.grid.place_agent(building, (x, self.height - 1))
            self.schedule.add(building)

        # Create left and right borders (excluding corners already placed)
        for y in range(1, self.height - 1):
            # Left border
            building = BuildingAgent(f"border_left_{y}", self)
            self.grid.place_agent(building, (0, y))
            self.schedule.add(building)
            
            # Right border
            building = BuildingAgent(f"border_right_{y}", self)
            self.grid.place_agent(building, (self.width - 1, y))
            self.schedule.add(building)

    def place_agent(self, agent, x, y):
        """Helper method to place agent and add to scheduler"""
        self.grid.place_agent(agent, (x, y))
        self.schedule.add(agent)

    def get_road_direction(self, pos):
        """Get the direction of the road at a given position"""
        cell_contents = self.grid.get_cell_list_contents(pos)
        for agent in cell_contents:
            if isinstance(agent, RoadAgent):
                return agent.direction
        return None

    def is_valid_spawn_point(self, pos):
        """Check if a position is a valid spawn point"""
        if pos not in self.spawn_points:
            return False
        
        # Check if position is already occupied by a car
        cell_contents = self.grid.get_cell_list_contents(pos)
        return not any(isinstance(agent, CarAgent) for agent in cell_contents)
    
    def add_car(self):
        """Try to add a new car at a valid spawn point"""
        # Obtener puntos de spawn válidos

        corner_spawns = [
            (0, 0),                    # Esquina inferior izquierda
            (0, self.height - 1),      # Esquina superior izquierda
            (self.width - 1, 0),       # Esquina inferior derecha
            (self.width - 1, self.height - 1)  # Esquina superior derecha
        ]

        cars_added = 0
    
        # Intentar agregar un carro en cada esquina
        for spawn_point in corner_spawns:
            if self.is_valid_spawn_point(spawn_point):
                car = CarAgent(f"car_{self.cars_created}", self)
                self.grid.place_agent(car, spawn_point)
                self.schedule.add(car)
                if car.find_destination():
                    car.path = car.find_path_astar()
                self.active_cars.append(car)
                self.cars_created += 1
                cars_added += 1
                print(f"Added car at corner {spawn_point}")
        
        return cars_added > 0

    def get_traffic_density(self):
        """Calculate current traffic density"""
        if not self.road_cells:
            return 0
        return (len(self.active_cars) / len(self.road_cells)) * 100

    def update_wait_times(self):
        """Update waiting time statistics"""
        for car in self.active_cars:
            if car.waiting_time > 0:
                self.total_wait_time += car.waiting_time
                self.wait_time_counts += 1

    def remove_agent(self, agent):
        """Remove an agent from the model"""
        if agent in self.active_cars:
            self.active_cars.remove(agent)
        self.grid.remove_agent(agent)
        self.schedule.remove(agent)

    def step(self):
        """Advance the model by one step"""
        if self.step_count == 0:
            self.add_car()

        self.step_count += 1
        
        # Try to spawn new cars every 10 steps
        if self.step_count % self.spawn_frequency == 0:
            self.add_car()
        
        self.schedule.step()
        
        # Update statistics
        self.update_wait_times()
from mesa import Agent
from enum import Enum, auto
import random
import heapq

class AgentType(Enum):
    CAR = auto()
    OBSTACLE = auto()
    BUILDING = auto()
    TRAFFIC_LIGHT = auto()
    DESTINATION = auto()
    ROAD = auto()

class CarAgent(Agent):
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model)
        self.agent_type = AgentType.CAR
        self.destination = None
        self.waiting_time = 0
        self.current_direction = None
        self.path = None
        self.find_destination()
        print(f"Car {unique_id} created, seeking destination")

    def heuristic(self, pos1, pos2):
        """Manhattan distance heuristic for A*"""
        return abs(pos1[0] - pos2[0]) + abs(pos1[1] - pos2[1])

    def get_valid_neighbors(self, pos):
        """Get valid neighboring positions"""
        neighbors = []
        x, y = pos
        
        for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            next_pos = (x + dx, y + dy)
            
            # Basic boundary check
            if not (0 <= next_pos[0] < self.model.grid.width and 
                   0 <= next_pos[1] < self.model.grid.height):
                continue
            
            # Check if movement is valid
            if self.is_valid_move(pos, next_pos):
                neighbors.append(next_pos)
        
        return neighbors

    def find_path_astar(self):
        """A* pathfinding implementation"""
        if not self.destination:
            return None

        start = self.pos
        goal = self.destination

        # Initialize data structures
        open_set = [(self.heuristic(start, goal), start)]
        came_from = {}
        g_score = {start: 0}
        f_score = {start: self.heuristic(start, goal)}
        closed_set = set()

        while open_set:
            current = heapq.heappop(open_set)[1]

            if current == goal:
                # Reconstruct path
                path = []
                while current in came_from:
                    path.append(current)
                    current = came_from[current]
                path.append(start)
                path.reverse()
                return path[1:] if len(path) > 1 else []

            closed_set.add(current)

            for neighbor in self.get_valid_neighbors(current):
                if neighbor in closed_set:
                    continue

                tentative_g_score = g_score[current] + 1

                if neighbor not in g_score or tentative_g_score < g_score[neighbor]:
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g_score
                    f = tentative_g_score + self.heuristic(neighbor, goal)
                    f_score[neighbor] = f
                    heapq.heappush(open_set, (f, neighbor))

        return None

    def calculate_movement_direction(self, current_pos, next_pos):
        """Calculate the direction of movement between two positions"""
        dx = next_pos[0] - current_pos[0]
        dy = next_pos[1] - current_pos[1]
        
        if dx > 0:
            return 'right'
        elif dx < 0:
            return 'left'
        elif dy > 0:
            return 'down'
        elif dy < 0:
            return 'up'
        return None

    def step(self):
        """Execute one step of the car's behavior"""
        if not self.destination:
            if not self.find_destination():
                return

        # Check if reached destination
        if self.pos == self.destination:
            print(f"Car {self.unique_id} reached destination {self.destination}")
            self.model.remove_agent(self)
            return

        # If no path exists or it's empty, calculate a new one
        if not self.path:
            self.path = self.find_path_astar()
            if not self.path:
                print(f"Car {self.unique_id} couldn't find path to destination")
                self.waiting_time += 1
                if self.waiting_time > 5:
                    self.find_destination()  # Try to find a new destination
                    self.waiting_time = 0
                return

        # Try to move to next position in path
        next_pos = self.path[0]
        if self.is_valid_move(self.pos, next_pos):
            # Actually move the agent
            print(f"Car {self.unique_id} moving from {self.pos} to {next_pos}")
            self.model.grid.move_agent(self, next_pos)
            self.path.pop(0)
            self.waiting_time = 0
            self.current_direction = self.calculate_movement_direction(self.pos, next_pos)
        else:
            # If can't move, increment waiting time and possibly recalculate path
            self.waiting_time += 1
            print(f"Car {self.unique_id} waiting at {self.pos}")
            if self.waiting_time > 3:
                self.path = self.find_path_astar()  # Recalculate path
                self.waiting_time = 0

    def is_valid_move(self, current_pos, next_pos):
        """Check if the move is valid considering all constraints"""
        # Check grid boundaries
        if not (0 <= next_pos[0] < self.model.grid.width and 
                0 <= next_pos[1] < self.model.grid.height):
            return False

        # Check for collisions with other cars or obstacles
        cell_contents = self.model.grid.get_cell_list_contents(next_pos)
        if any(isinstance(agent, (CarAgent, ObstacleAgent)) for agent in cell_contents):
            return False

        # If it's the destination, it's valid
        if next_pos == self.destination:
            return True

        # Check if there's a valid road direction
        road_exists = False
        for agent in self.model.grid.get_cell_list_contents(next_pos):
            if isinstance(agent, RoadAgent):
                road_exists = True
                break
        if not road_exists:
            return False

        # Calculate movement direction
        movement_dir = self.calculate_movement_direction(current_pos, next_pos)
        if not movement_dir:
            return False

        # Check traffic lights
        traffic_lights = [agent for agent in cell_contents 
                         if isinstance(agent, TrafficLightAgent)]
        if traffic_lights:
            traffic_light = traffic_lights[0]
            dx = next_pos[0] - current_pos[0]
            dy = next_pos[1] - current_pos[1]
            
            if traffic_light.state == "red":
                if traffic_light.orientation == "horizontal" and dx != 0:
                    return False
                if traffic_light.orientation == "vertical" and dy != 0:
                    return False

        # Check if this is a valid turn
        return self.is_valid_turn(current_pos, next_pos)

    def is_valid_turn(self, current_pos, next_pos):
        """Check if a turn is valid based on road directions"""
        current_directions = self.get_road_directions(current_pos)
        next_directions = self.get_road_directions(next_pos)
        
        if not current_directions or not next_directions:
            return False

        movement_dir = self.calculate_movement_direction(current_pos, next_pos)
        if not movement_dir:
            return False

        valid_turns = {
            'right': {'up', 'down', 'right'},
            'left': {'up', 'down', 'left'},
            'up': {'left', 'right', 'up'},
            'down': {'left', 'right', 'down'}
        }

        for current_dir in current_directions:
            if movement_dir in valid_turns[current_dir]:
                for next_dir in next_directions:
                    if next_dir in valid_turns[movement_dir]:
                        return True
        return False

    def get_road_directions(self, pos):
        """Get all valid road directions at a position"""
        cell_contents = self.model.grid.get_cell_list_contents(pos)
        directions = set()
        for agent in cell_contents:
            if isinstance(agent, RoadAgent):
                directions.add(agent.direction)
        return list(directions)

    def find_destination(self):
        """Find a random destination from available destinations"""
        if self.model.available_destinations:
            self.destination = random.choice(self.model.available_destinations)
            print(f"Car {self.unique_id} assigned destination: {self.destination}")
            self.path = None  # Reset path when new destination is assigned
            return True
        return False
    
class TrafficAgent(Agent):
    """Base class for all traffic agents"""
    def __init__(self, unique_id: str, model, agent_type: AgentType):
        super().__init__(unique_id, model)
        self.agent_type = agent_type
   
class TrafficLightAgent(TrafficAgent):
    def __init__(self, unique_id, model, orientation):
        super().__init__(unique_id, model, AgentType.TRAFFIC_LIGHT)
        self.orientation = orientation
        self.state = "green"  # Iniciar en verde
        self.timer = 10
        self.base_timer = 10
        self.min_timer = 5
        self.max_timer = 20

    def count_waiting_cars(self):
        """Count cars waiting at this traffic light"""
        waiting = 0
        neighbors = self.model.grid.get_neighbors(
            self.pos, moore=False, include_center=True, radius=1
        )
        for neighbor in neighbors:
            if isinstance(neighbor, CarAgent):
                waiting += 1
        return waiting

    def step(self):
        """Update traffic light state"""
        cars_waiting = self.count_waiting_cars()
        
        # Reducir el timer más rápido si hay carros esperando
        if cars_waiting > 0:
            self.timer -= 2
        else:
            self.timer -= 1
            
        # Cambiar estado cuando el timer llega a 0
        if self.timer <= 0:
            self.state = "green" if self.state == "red" else "red"
            print(f"Traffic light {self.unique_id} changed to {self.state}")
            
            # Ajustar el timer basado en los carros esperando
            self.timer = max(self.min_timer, 
                           min(self.max_timer, 
                               self.base_timer + (cars_waiting * 2)))

class RoadAgent(TrafficAgent):
    """Road agent with direction information"""
    def __init__(self, unique_id, model, direction):
        super().__init__(unique_id, model, AgentType.ROAD)
        self.direction = direction.lower()  # Asegurar que la dirección esté en minúsculas
        print(f"Road created at {self.pos} with direction {self.direction}")  # Debug info
    
    def step(self):
        """Roads don't need to do anything on their step"""
        pass

class ObstacleAgent(TrafficAgent):
    """Obstacle agent"""
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model, AgentType.OBSTACLE)
    
    def step(self):
        pass

class BuildingAgent(TrafficAgent):
    """Building agent"""
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model, AgentType.BUILDING)
    
    def step(self):
        pass

class DestinationAgent(TrafficAgent):
    """Destination agent"""
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model, AgentType.DESTINATION)
    
    def step(self):
        pass
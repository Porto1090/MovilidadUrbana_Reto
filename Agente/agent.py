from mesa import Agent
from enum import Enum, auto
import random
import heapq

class AgentType(Enum):
    CAR = auto()
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
            return 'up'
        elif dy < 0:
            return 'down'
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
        
        # Get current cell contents to check for traffic light
        current_cell_contents = self.model.grid.get_cell_list_contents(self.pos)
        next_cell_contents = self.model.grid.get_cell_list_contents(next_pos)
        
        # Check for traffic lights first
        traffic_lights = [agent for agent in next_cell_contents 
                        if isinstance(agent, TrafficLightAgent)]
        
        if traffic_lights:
            traffic_light = traffic_lights[0]
            dx = next_pos[0] - self.pos[0]
            dy = next_pos[1] - self.pos[1]
            
            # If light is red and moving in the restricted direction, wait
            if traffic_light.state == "red":
                if (traffic_light.orientation == "horizontal" and abs(dx) > 0) or \
                (traffic_light.orientation == "vertical" and abs(dy) > 0):
                    print(f"Car {self.unique_id} waiting at traffic light at {self.pos}")
                    self.waiting_time += 1
                    return
        
        # If movement is valid, move the car
        if self.is_valid_move(self.pos, next_pos):
            print(f"Car {self.unique_id} moving from {self.pos} to {next_pos}")
            self.model.grid.move_agent(self, next_pos)
            self.path.pop(0)
            self.waiting_time = 0
            self.current_direction = self.calculate_movement_direction(self.pos, next_pos)
        else:
            # If can't move, increment waiting time and recalculate path if waiting too long
            self.waiting_time += 1
            print(f"Car {self.unique_id} waiting at {self.pos}")
            if self.waiting_time > 3:
                print(f"Car {self.unique_id} recalculating path due to long wait")
                self.path = self.find_path_astar()  # Recalculate path
                self.waiting_time = 0

    def is_valid_move(self, current_pos, next_pos):
        """Check if the move is valid considering all constraints"""
        # Check grid boundaries
        if not (0 <= next_pos[0] < self.model.grid.width and 
                0 <= next_pos[1] < self.model.grid.height):
            return False

        # Check if it's the destination
        if next_pos == self.destination:
            return True

        # Get cell contents at next position
        cell_contents = self.model.grid.get_cell_list_contents(next_pos)

        traffic_lights = [agent for agent in cell_contents 
                        if isinstance(agent, TrafficLightAgent)]

        if traffic_lights:
            traffic_light = traffic_lights[0]
            # Si hay un semáforo y está en rojo, el carro se detiene completamente
            if traffic_light.state == "red":
                print(f"Car {self.unique_id} stopped at red light at {next_pos}")
                self.waiting_time += 1
                return False

        # Check for collisions with other cars or obstacles
        if any(isinstance(agent, (CarAgent, BuildingAgent)) for agent in cell_contents):
            return False

        # Check if there's a valid road direction
        road_exists = False
        for agent in cell_contents:
            if isinstance(agent, RoadAgent):
                road_exists = True
                break
        if not road_exists:
            return False

        # Calculate movement direction
        movement_dir = self.calculate_movement_direction(current_pos, next_pos)
        if not movement_dir:
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
        # Iniciar los semáforos en estados opuestos según orientación
        self.state = "green" if orientation == "horizontal" else "red"
        self.timer = 10
        self.base_timer = 10
        self.min_timer = 5
        self.max_timer = 20

    def step(self):
        """Update traffic light state"""
        # Solo el primer semáforo horizontal controla el cambio
        if self.is_group_leader():
            cars_waiting = self.count_waiting_cars()
            
            if cars_waiting > 0:
                self.timer -= 2
            else:
                self.timer -= 1
                
            if self.timer <= 0:
                # Cambiar estados de todos los semáforos
                self.switch_all_traffic_lights()
                
                # Reiniciar timer
                self.timer = max(self.min_timer, 
                               min(self.max_timer, 
                                   self.base_timer + (cars_waiting * 2)))

    def is_group_leader(self):
        """Solo el primer semáforo horizontal será el líder"""
        horizontal_lights = [agent for agent in self.model.traffic_lights 
                           if agent.orientation == "horizontal"]
        return self == horizontal_lights[0] if horizontal_lights else False

    def switch_all_traffic_lights(self):
        """Cambiar estados de todos los semáforos"""
        for light in self.model.traffic_lights:
            if light.orientation == "horizontal":
                light.state = "green" if light.state == "red" else "red"
            else:  # vertical
                light.state = "red" if light.state == "green" else "green"
            light.timer = self.timer
            print(f"Traffic light {light.unique_id} ({light.orientation}) changed to {light.state}")
    
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

class RoadAgent(TrafficAgent):
    """Road agent with direction information"""
    def __init__(self, unique_id, model, direction):
        super().__init__(unique_id, model, AgentType.ROAD)
        self.direction = direction.lower()  # Asegurar que la dirección esté en minúsculas
        print(f"Road created at {self.pos} with direction {self.direction}")  # Debug info
    
    def step(self):
        """Roads don't need to do anything on their step"""
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
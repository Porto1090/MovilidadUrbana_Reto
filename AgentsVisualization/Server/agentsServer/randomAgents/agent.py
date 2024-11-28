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

class TrafficAgent(Agent):
    """Base class for all traffic agents"""
    def __init__(self, unique_id: str, model, agent_type: AgentType):
        super().__init__(unique_id, model)
        self.agent_type = agent_type
        
class CarAgent(TrafficAgent):
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model, AgentType.CAR)
        self.steps_taken = 0
        self.destination = None
        self.orientation = None
        self.waiting_time = 0
        self.path = None

    def heuristic(self, pos1, pos2):
        """Manhattan distance heuristic for A*"""
        return abs(pos1[0] - pos2[0]) + abs(pos1[1] - pos2[1])

    def get_direction(self, pos, next_pos):
        """Obtener la dirección del movimiento para un agente carro"""
        dx = next_pos[0] - pos[0]
        dy = next_pos[1] - pos[1]
        
        if dx == 0 and dy == 1:
            return "down"
        elif dx == 0 and dy == -1:
            return "up"
        elif dx == 1 and dy == 0:
            return "right"
        elif dx == -1 and dy == 0:
            return "left"
        return None

    def get_valid_neighbors(self, pos):
        """Get valid neighboring positions"""
        neighbors = []
        x, y = pos
        
        for dx, dy in [(0, 1), (0, -1), (1, 0), (-1, 0)]:
            next_pos = (x + dx, y + dy)
            
            if not (0 <= next_pos[0] < self.model.grid.width and 
                   0 <= next_pos[1] < self.model.grid.height):
                continue
            
            if self.is_valid_move(pos, next_pos):
                neighbors.append(next_pos)
        
        return neighbors

    def find_path_astar(self):
        """A* pathfinding implementation"""
        if not self.destination:
            return None

        start = self.pos
        goal = self.destination

        open_set = [(0, start)]
        came_from = {}
        g_score = {start: 0}
        f_score = {start: self.heuristic(start, goal)}
        closed_set = set()

        while open_set:
            current = heapq.heappop(open_set)[1]

            if current == goal:
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

    def step(self):
        """Execute one step of the car's behavior"""
        
        # Si no tenemos destino, lo buscamos
        if not self.destination:
            if not self.find_destination():
                return

        # Intentamos calcular un camino
        if not self.path:
            self.path = self.find_path_astar()

        # Si no podemos calcular el camino y estamos en el destino, terminamos
        if not self.path and self.pos == self.destination:
            self.model.remove_agent(self)  # Eliminamos el coche porque ya está en su destino
            return

        # Si no podemos calcular el camino y no estamos en el destino, cambiamos de destino
        if not self.path:
            self.find_destination()
            self.path = self.find_path_astar()  # Recalculamos el camino hacia el nuevo destino

        # Ahora nos aseguramos de que el coche se mueva si ya tiene un camino
        if self.path is None or len(self.path) == 0:
            self.find_destination()
            self.path = self.find_path_astar()
            return

        # Ahora nos aseguramos de que el coche se mueva si ya tiene un camino
        next_pos = self.path[0]
        self.orientation = self.get_direction(self.pos, next_pos)
        
        # Verificar semáforos
        cell_contents = self.model.grid.get_cell_list_contents(next_pos)
        traffic_lights = [agent for agent in cell_contents 
                        if isinstance(agent, TrafficLightAgent)]
        
        if traffic_lights:
            traffic_light = traffic_lights[0]
            dx = next_pos[0] - self.pos[0]
            dy = next_pos[1] - self.pos[1]
            
            if traffic_light.state == "red":
                if (traffic_light.orientation == "horizontal" and abs(dx) > 0) or \
                   (traffic_light.orientation == "vertical" and abs(dy) > 0):
                    self.waiting_time += 1
                    return
        
        if self.is_valid_move(self.pos, next_pos):
            self.model.grid.move_agent(self, next_pos)
            self.path.pop(0)  # Eliminamos la primera casilla del camino
            self.waiting_time = 0
        else:
            # Si no podemos movernos, cambiamos de destino
            self.waiting_time += 1
            if self.waiting_time > 3:  # Si el coche no ha podido moverse en 3 pasos, cambia de destino
                self.find_destination()
                self.path = self.find_path_astar()
                self.waiting_time = 0

    def is_valid_move(self, current_pos, next_pos):
        """Check if the move is valid considering all constraints"""
        # Verificar límites del grid
        if not (0 <= next_pos[0] < self.model.grid.width and 
                0 <= next_pos[1] < self.model.grid.height):
            return False

        # Si es el destino, permitir el movimiento
        if next_pos == self.destination:
            return True

        cell_contents = self.model.grid.get_cell_list_contents(next_pos)

        # Verificar colisiones con otros carros o edificios
        if any(isinstance(agent, (CarAgent, BuildingAgent, DestinationAgent)) for agent in cell_contents):
            return False

        # Verificar semáforos
        for agent in cell_contents:
            if isinstance(agent, TrafficLightAgent):
                # Si hay un semáforo en rojo, no se puede avanzar
                if agent.state == "red":
                    return False
                  
        # Verificar dirección válida de la calle
        roads = [agent for agent in cell_contents if isinstance(agent, RoadAgent)]
        if not roads:
            return False

        # Obtener la dirección del movimiento
        movement_dir = self.get_direction(current_pos, next_pos)
        
        # Verificar que la dirección del movimiento coincida con la dirección de la calle
        road_directions = {road.direction for road in roads}
        
        valid_moves = {
            'right': {'right', 'up', 'down'},
            'left': {'left', 'up', 'down'},
            'up': {'up', 'left', 'right'},
            'down': {'down', 'left', 'right'}
        }

        return any(movement_dir in valid_moves[road_dir] for road_dir in road_directions)

    def find_destination(self):
        """Find a random destination from available destinations"""
        if self.model.available_destinations:
            self.destination = random.choice(self.model.available_destinations)
            self.path = None  # Restablecemos el camino
            return True
        return False

class TrafficLightAgent(TrafficAgent):
    def __init__(self, unique_id, model, orientation):
        super().__init__(unique_id, model, AgentType.TRAFFIC_LIGHT)
        self.orientation = orientation
        self.state = "green" if orientation == "horizontal" else "red"
        self.timer = 10
        self.base_timer = 10
        self.min_timer = 5
        self.max_timer = 20

    def step(self):
        if self.is_group_leader():
            cars_waiting = self.count_waiting_cars()
            
            if cars_waiting > 0:
                self.timer -= 2
            else:
                self.timer -= 1
                
            if self.timer <= 0:
                self.switch_all_traffic_lights()
                self.timer = max(self.min_timer, 
                               min(self.max_timer, 
                                   self.base_timer + (cars_waiting * 2)))

    def is_group_leader(self):
        horizontal_lights = [agent for agent in self.model.traffic_lights 
                           if agent.orientation == "horizontal"]
        return self == horizontal_lights[0] if horizontal_lights else False

    def switch_all_traffic_lights(self):
        for light in self.model.traffic_lights:
            if light.orientation == "horizontal":
                light.state = "green" if light.state == "red" else "red"
            else:
                light.state = "red" if light.state == "green" else "green"
            light.timer = self.timer

    def count_waiting_cars(self):
        waiting = 0
        neighbors = self.model.grid.get_neighbors(
            self.pos, moore=False, include_center=True, radius=1
        )
        for neighbor in neighbors:
            if isinstance(neighbor, CarAgent):
                waiting += 1
        return waiting

class RoadAgent(TrafficAgent):
    def __init__(self, unique_id, model, direction):
        super().__init__(unique_id, model, AgentType.ROAD)
        self.direction = direction.lower()
    
    def step(self):
        pass

class BuildingAgent(TrafficAgent):
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model, AgentType.BUILDING)
    
    def step(self):
        pass

class DestinationAgent(TrafficAgent):
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model, AgentType.DESTINATION)
    
    def step(self):
        pass
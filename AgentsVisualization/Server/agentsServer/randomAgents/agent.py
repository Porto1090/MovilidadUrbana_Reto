from mesa import Agent
from enum import Enum, auto
import heapq
import random

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
    """
    Agent that follows traffic rules and moves in the direction of arrows
    """
    def __init__(self, unique_id, model):
        super().__init__(unique_id, model, AgentType.CAR)
        self.steps_taken = 0
        self.destination = None
        self.orientation = None
        self.path = []
        self.max_path_attempts = 5  # Límite de intentos para encontrar ruta

    def heuristic(self, a, b):
        """Manhattan distance heuristic"""
        return abs(a[0] - b[0]) + abs(a[1] - b[1])
    
    def is_valid_move(self, current_pos, next_pos):
        """
        Verifica si el movimiento es válido considerando:
        1. Límites del mapa
        2. Semáforos
        3. Presencia de otros agentes
        """
        # Verificar límites del mapa
        if not (0 <= next_pos[0] < self.model.grid.width and 
                0 <= next_pos[1] < self.model.grid.height):
            return False
        
        # Si es el destino final, siempre es válido
        if next_pos == self.destination:
            return True
        
        # Obtener contenido de la celda
        cell_contents = self.model.grid.get_cell_list_contents(next_pos)
        
        # Verificar semáforos
        for agent in cell_contents:
            if isinstance(agent, TrafficLightAgent):
                # Si hay un semáforo en rojo, no se puede avanzar
                if agent.state == "red":
                    return False
        
        # Verificar que no haya carros o edificios
        return not any(isinstance(agent, (CarAgent, BuildingAgent, DestinationAgent)) for agent in cell_contents)
    
    def get_valid_neighbors(self, pos):
        """
        Obtener vecinos válidos considerando las restricciones de movimiento
        """
        x, y = pos
        neighbors = [(x, y-1), (x, y+1), (x+1, y), (x-1, y)]
        return [neighbor for neighbor in neighbors if self.is_valid_move(pos, neighbor)]

    def get_direction(self, pos, next_pos):
        """
        Obtener la dirección del movimiento para un agente carro
        """
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
        return
    
    def is_direction_consistent(self, road_direction, current_pos, next_pos):
        """
        Verifica si el movimiento es consistente con la dirección de la calle
        """
        dx = next_pos[0] - current_pos[0]
        dy = next_pos[1] - current_pos[1]
        
        # Mapeo de direcciones
        direction_map = {
            'up': (0, 1),
            'down': (0, -1),
            'right': (1, 0),
            'left': (-1, 0)
        }
        
        # Si no hay dirección de calle definida, permitir movimiento
        if not road_direction:
            return True
        
        # Verificar si el movimiento coincide con la dirección de la calle
        expected_move = direction_map.get(road_direction, (dx, dy))
        print(f"Expected move: {expected_move}, Actual move: ({dx}, {dy})")
        return (dx, dy) == expected_move

    def find_path_astar(self):
        """Implementación de A* para encontrar ruta"""
        if not self.destination:
            return None

        start = self.pos
        goal = self.destination

        # Estructuras de datos para A*
        open_set = [(self.heuristic(start, goal), start)]
        came_from = {}
        g_score = {start: 0}
        f_score = {start: self.heuristic(start, goal)}
        closed_set = set()

        while open_set:
            current = heapq.heappop(open_set)[1]

            if current == goal:
                # Reconstruir camino
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

    def find_destination(self):
        """Encontrar un destino aleatorio disponible"""
        if self.model.available_destinations:
            self.destination = random.choice(self.model.available_destinations)
            return True
        return False
    
    def step(self):
        """Lógica de movimiento del agente carro"""
        self.steps_taken += 1
        
        # Si no hay destino, buscar uno
        if not self.destination:
            if not self.find_destination():
                return
        
        # Si ya llegó al destino, remover el agente
        if self.pos == self.destination:
            self.model.remove_agent(self)
            return
        
        # Si no hay ruta, calcular una nueva
        if not self.path:
            self.path = self.find_path_astar()
        
        # Si no hay ruta posible después de múltiples intentos, 
        # buscar otro destino o quedarse quieto
        if not self.path:
            if self.steps_taken % self.max_path_attempts == 0:
                self.destination = None
            return
        
        next_pos = self.path[0]
        self.orientation = self.get_direction(self.pos, next_pos)
        
        # Verificar movimiento válido considerando:
        # 1. Validez de la posición
        # 2. Consistencia con dirección de la calle
        if (self.is_valid_move(self.pos, next_pos)):
            # and self.is_direction_consistent(current_road_direction, self.pos, next_pos)):
            self.model.grid.move_agent(self, next_pos)
            self.path.pop(0)
        else:
            # Si no es un movimiento válido, recalcular ruta
            self.path = self.find_path_astar()

class TrafficLightAgent(TrafficAgent):
    """Agent that represents traffic lights"""
    def __init__(self, unique_id, model, orientation):
        super().__init__(unique_id, model, AgentType.TRAFFIC_LIGHT)
        self.orientation = orientation  # "horizontal" or "vertical"
        self.state = "green"
        self.countdown = 5  # Steps until state change

    def step(self):
        self.countdown -= 1
        if self.countdown <= 0:
            self.state = "green" if self.state == "red" else "red"
            self.countdown = 5
            
class RoadAgent(TrafficAgent):
    """Agent that represents directional arrows"""
    def __init__(self, unique_id, model, direction):
        super().__init__(unique_id, model, AgentType.ROAD)
        self.direction = direction
    
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
from mesa import Agent
from enum import Enum, auto

class AgentType(Enum):
    CAR = auto()
    OBSTACLE = auto()
    BUILDING = auto()
    TRAFFIC_LIGHT = auto()
    DESTINATION = auto()
    DIRECTION = auto()
    
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

    def step(self):
        pass

class RoadAgent(TrafficAgent):
    """Agent that represents directional arrows"""
    def __init__(self, unique_id, model, direction):
        super().__init__(unique_id, model, AgentType.DIRECTION)
        self.direction = direction
    
    def step(self):
        pass

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
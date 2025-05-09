from datetime import datetime
from typing import TypeVar, Type, Any, Dict, List, Optional, Union
from uuid import UUID

from pydantic import BaseModel

# Type definitions for clearer usage
ModelType = TypeVar("ModelType")  # Can be SQLAlchemy model or dict from direct DB query
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)

def model_to_dict(obj: Any) -> Dict[str, Any]:
    """
    Convert a model instance to a dictionary.
    Works with both SQLAlchemy models and dictionary records from direct DB queries.
    """
    if isinstance(obj, dict):
        # Already a dict (from direct database query)
        return obj
    
    # Check if it has __table__ attribute (SQLAlchemy model)
    if hasattr(obj, '__table__'):
        return {c.key: getattr(obj, c.key) for c in obj.__table__.columns}
    
    # Generic object, try to get all attributes
    return {key: value for key, value in obj.__dict__.items() 
            if not key.startswith('_')}

def convert_field_to_camel(snake_str: str) -> str:
    """Convert snake_case to camelCase."""
    components = snake_str.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])

def convert_datetime(dt: datetime) -> str:
    """Convert datetime to ISO format string."""
    return dt.isoformat() if dt else None

def convert_uuid(uuid: UUID) -> str:
    """Convert UUID to string."""
    return str(uuid) if uuid else None

def create_schema_from_model(
    db_item: Union[ModelType, Dict[str, Any]],
    schema_type: Type[CreateSchemaType]
) -> CreateSchemaType:
    """
    Convert a database model or record to a Pydantic schema.
    Handles both SQLAlchemy models and dictionary records from direct DB queries.
    """
    db_dict = model_to_dict(db_item)
    
    # Convert any datetime or UUID fields
    processed_dict = {}
    for key, value in db_dict.items():
        if isinstance(value, datetime):
            processed_dict[key] = convert_datetime(value)
        elif isinstance(value, UUID):
            processed_dict[key] = convert_uuid(value)
        else:
            processed_dict[key] = value
            
    return schema_type(**processed_dict)

def create_schemas_from_models(
    db_items: List[Union[ModelType, Dict[str, Any]]],
    schema_type: Type[CreateSchemaType]
) -> List[CreateSchemaType]:
    """Convert multiple database models or records to Pydantic schemas."""
    return [create_schema_from_model(item, schema_type) for item in db_items]

def validate_schema(schema_instance: BaseModel) -> Dict[str, Any]:
    """Validate a Pydantic schema and return it as a dictionary."""
    return schema_instance.model_dump()

def update_model_from_schema(
    db_model: ModelType,
    update_schema: UpdateSchemaType,
    exclude_unset: bool = True
) -> ModelType:
    """
    Update a database model from a Pydantic schema.
    Works with both SQLAlchemy models and plain objects.
    """
    update_data = update_schema.model_dump(exclude_unset=exclude_unset)
    
    # Handle SQLAlchemy models or plain objects
    if hasattr(db_model, '__dict__'):
        for key, value in update_data.items():
            setattr(db_model, key, value)
    elif isinstance(db_model, dict):
        db_model.update(update_data)
        
    return db_model

def prepare_db_values(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Prepare dictionary values for database insertion.
    Converts Python objects to database-friendly types.
    """
    result = {}
    for key, value in data.items():
        if isinstance(value, datetime):
            result[key] = value.isoformat()
        elif isinstance(value, UUID):
            result[key] = str(value)
        elif isinstance(value, (dict, list)):
            # For JSON fields
            result[key] = value
        else:
            result[key] = value
    return result
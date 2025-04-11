from datetime import datetime
from typing import TypeVar, Type, Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy.orm import DeclarativeBase

ModelType = TypeVar("ModelType", bound=DeclarativeBase)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)

def model_to_dict(obj: Any) -> Dict[str, Any]:
    """Convert a SQLAlchemy model instance to a dictionary."""
    return {c.key: getattr(obj, c.key)
            for c in obj.__table__.columns}

def convert_field_to_camel(snake_str: str) -> str:
    """Convert snake_case to camelCase."""
    components = snake_str.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])

def convert_datetime(dt: datetime) -> str:
    """Convert datetime to ISO format string."""
    return dt.isoformat()

def convert_uuid(uuid: UUID) -> str:
    """Convert UUID to string."""
    return str(uuid)

def create_schema_from_model(
    db_item: ModelType,
    schema_type: Type[CreateSchemaType]
) -> CreateSchemaType:
    """Convert a database model to a Pydantic schema."""
    db_dict = model_to_dict(db_item)
    # Convert any datetime or UUID fields
    for key, value in db_dict.items():
        if isinstance(value, datetime):
            db_dict[key] = convert_datetime(value)
        elif isinstance(value, UUID):
            db_dict[key] = convert_uuid(value)
    return schema_type(**db_dict)

def create_schemas_from_models(
    db_items: List[ModelType],
    schema_type: Type[CreateSchemaType]
) -> List[CreateSchemaType]:
    """Convert multiple database models to Pydantic schemas."""
    return [create_schema_from_model(item, schema_type) for item in db_items]

def dict_to_model(data: Dict[str, Any], model_type: Type[ModelType]) -> ModelType:
    """Convert a dictionary to a SQLAlchemy model instance."""
    return model_type(**data)

def validate_schema(schema_instance: BaseModel) -> Dict[str, Any]:
    """Validate a Pydantic schema and return it as a dictionary."""
    return schema_instance.model_dump()

def update_model_from_schema(
    db_model: ModelType,
    update_schema: UpdateSchemaType,
    exclude_unset: bool = True
) -> ModelType:
    """Update a database model from a Pydantic schema."""
    update_data = update_schema.model_dump(exclude_unset=exclude_unset)
    for key, value in update_data.items():
        setattr(db_model, key, value)
    return db_model
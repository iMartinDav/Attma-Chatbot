from fastapi.routing import APIRoute


def simple_generate_unique_route_id(route: APIRoute):
    """Generate a unique ID for a route using tags and name.
    If no tags are available, use 'default' as the tag."""
    tag = route.tags[0] if route.tags else "default"
    return f"{tag}-{route.name}"

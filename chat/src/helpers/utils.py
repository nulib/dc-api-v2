def to_bool(val):
    """Converts a value to boolean. If the value is a string, it considers
    "", "no", "false", "0" as False. Otherwise, it returns the boolean of the value.
    """
    if isinstance(val, str):
        return val.lower() not in ["", "no", "false", "0"]
    return bool(val)

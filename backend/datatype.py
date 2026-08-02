import pandas as pd

def detect_datatype(df):
    datatypes ={}

    for column in df.columns:
         dtype= df[column].dtype
         datatypes[column]= str(df[column].dtype)
    return datatypes












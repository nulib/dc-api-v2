# API Load Testing

The API's load tests are written using the [Locust](https://locust.io/) load testing framework.

## Usage

### Set up dependencies
```shell
python -m venv ./.venv
. ./.venv/bin/activate
pip install -r requirements.txt
```

### Start server
```shell
API_BASE_URL=https://dcapi.rdc-staging.library.northwestern.edu/api/v2 # or whatever
locust -f locustfile.py --host=${API_BASE_URL} --processes -1
```

### Run load tests
1. Open http://localhost:8089/ in a browser.
2. Customize test parameters (peak user count, ramp up, run time, etc.).
3. Click **Start**.
4. You can click around the UI while the test is running to see statistics, graphs, etc.

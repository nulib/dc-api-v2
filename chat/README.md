# dc-api-v2 chatbot

[![Build Status](https://github.com/nulib/dc-api-v2/actions/workflows/test-python.yml/badge.svg)](https://github.com/nulib/dc-api-v2/actions/workflows/test-python.yml)

## Local development setup

##### ⚠️ *All commands and instructions in this file assume that the current working directory is the `/chat` subdirectory of the `dc-api-v2` project.*

### Link `samconfig.yaml`

This only needs to be done once.

1. Pull the `miscellany` repo.
2. Link the development `samconfig.yaml` file
   ```bash
   ln -s /path/to/miscellany/dc-api-v2/chat/samconfig.yaml .
   ```

### Deploy a development stack

1. [Log into AWS](http://docs.rdc.library.northwestern.edu/2._Developer_Guides/Environment_and_Tools/AWS-Authentication/) using your `staging-superuser` profile.
2. Pick a unique stack name, e.g., `dc-api-chat-[YOUR_INITIALS]`
3. Create or synchronize the development stack
   ```bash
   sam sync --watch --config-env dev --stack-name [STACK_NAME]
   ```

The first time the `sam sync` command is run, it will build the development stack. This takes longer than it will on subsequent runs.

While the `sam sync` remains open, it will keep the development stack synchronized with any code changes you make. Each time you change a file, you'll need to wait for the output of that command to indicate that resource syncing is finished.

The first time the stack is created, it will show you the stack's outputs, including the websocket URL to use for interacting with the chat backend, e.g.:
```
-------------------------------------------------------------------------------------------------
CloudFormation outputs from deployed stack
-------------------------------------------------------------------------------------------------
Outputs                                                                                         
-------------------------------------------------------------------------------------------------
Key                 WebSocketURI                                                                
Description         The WSS Protocol URI to connect to                                          
Value               wss://nmom3hnp3c.execute-api.us-east-1.amazonaws.com/latest                 
-------------------------------------------------------------------------------------------------
```

On subsequent sync runs, the outputs will not be displayed. If you need to retrieve the value again, you can run
```bash
sam list stack-outputs --stack-name [STACK_NAME]
```

To stop synchronizing changes, simply terminate the `sam sync` process with `Ctrl+C`.

### Tear down the development stack

The development stack will remain up and active even after `sam sync` exits; it will simply not actively synchronize changes any more. To tear it down completely, you have to delete it yourself.

1. [Log into AWS](http://docs.rdc.library.northwestern.edu/2._Developer_Guides/Environment_and_Tools/AWS-Authentication/) using your `staging-admin` profile.
2. Delete the development stack
   ```bash
   sam delete --stack-name [STACK_NAME]
   ```

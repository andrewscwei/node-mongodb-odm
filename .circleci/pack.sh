#!/bin/bash

source .circleci/get_opts.sh

npm pack
tar -xvzf $PACKAGE_FILE.tgz

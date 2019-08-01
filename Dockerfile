FROM node:12.4-alpine

ENV NPM_CONFIG_LOGLEVEL info

# Run time dependencies
#RUN "npm install requirejs"
COPY node_modules/ /home/node/app/node_modules/

WORKDIR /home/node/app
COPY src /home/node/app/src/
COPY target /home/node/app/target/
COPY package.json /home/node/app/
COPY server.js /home/node/app/
COPY settings.json /home/node/app/

CMD ["/usr/local/bin/node","server.js"]

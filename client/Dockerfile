FROM node:12.4-alpine

ENV NPM_CONFIG_LOGLEVEL info

# Run time dependencies
#RUN "npm install requirejs"
#COPY node_modules/ /home/node/app/node_modules/

WORKDIR /home/node/app
COPY package*.json /home/node/app/
RUN npm ci --only=production

COPY src /home/node/app/src/
COPY server.js /home/node/app/
COPY settings.json /home/node/app/
COPY passwd.json /home/node/app/
COPY lightfestival-firebase-adminsdk.json /home/node/app/

#RUN npm install --no-optional && npm cache clean --force

CMD ["/usr/local/bin/node","server.js"]

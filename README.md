#### Rough Readme WIP

To run locally, start your DB
`docker-compose up -d postgres`

Then start the app
`npm run dev`

---

This is currently deployed on Hetzner, I moved it off of AWS because I get more resources there. Nginx to route traffic to my "apps" (just one for now), but will add more in the future. The app is a Remix FE served by Express and Postgres for data. I'm using docker-compose to manage everything.

Wherever you deploy, make sure your network settings allow:

- Inbound
  - HTTP (80) - Anywhere
  - HTTPS (443) - Anywhere
  - Custom TCP (5432) - Your IP - For database access with TablePlus or your favorite database client
  - SSH (22) - Your IP
- Outbound
  - All traffic - Anywhere

Modify your `nginx.conf` and `docker-compose.yml` files as needed. Push the repo to GitHub. Build your docker image and push it to the docker hub.

Note that this deployment is building from an ARM Mac to ARM VM running Ubuntu. If you're deploying to a different architecture, you'll have to build the images on the target architecture and use `yum` instead of `apt-get` or whatever package manager is appropriate for your OS.

> Only have to do this once

```bash
docker buildx create --name multiarch --use
```

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t joswayski/josevalerio:latest . --push
```

Transfer your `.env`, `docker-compose.yml`, and `nginx.conf` files to your server.

```bash
rsync -avz --progress .env  docker-compose.yml nginx.conf root@your-server-ip:josevalerio.com
```

SSH into your instance and setup your environment. We're going to install docker, docker-compose, pull the images, and start our Postgres DB.

```bash
ssh root@<your-ip>
```

```bash
sudo apt-get update -y && sudo apt-get install docker.io -y && sudo systemctl start docker && sudo systemctl enable docker && sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose && sudo chmod +x /usr/local/bin/docker-compose && cd josevalerio.com && sudo docker-compose pull
```

Spin up postgres

```bash
sudo docker-compose up -d postgres
```

Then we'll create the necessary databases and start the rest of the services. I didn't feel like adding this with Knex since its a one time setup and adding another script so, just connect with TablePlus if you want to manage / create the DBs.

After you're done, start the rest of the services.

```bash
sudo docker-compose up -d
```

Make sure to updated the `A` and `AAAA` records in CloudFlare to point to the IP of the server.

Have fun!

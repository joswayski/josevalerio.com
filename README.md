#### Rough Readme WIP

Create a VPC with an ipv6 subnet - aws is chargin $4 / mo per ip address so. yeah
https://aws.amazon.com/blogs/networking-and-content-delivery/introducing-ipv6-only-subnets-and-ec2-instances/

TODO- if you dont have access to ipv6 use this https://tunnelbroker.net/new_tunnel.php

Create an instance

Create an SSH key pair

chmod 400 “KEY_NAME.pem”

Allow SSH access to the instance
TODO: ipv6!!
ssh -i “KEY_NAME.pem" ec2-user@ec2-XX-XXX-XXX-XX.compute-1.amazonaws.com

sudo yum update -y && sudo yum install git docker -y && sudo systemctl start docker && sudo systemctl enable docker && sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose && sudo chmod +x /usr/local/bin/docker-compose && git clone https://github.com/joswayski/josevalerio.com.git && cd josevalerio.com && sudo docker-compose pull && sudo docker-compose up -d

-
- # certbot stuff

# Install python3 and augeas-libs

sudo yum install python3 augeas-libs -y && \

# Create a virtual environment for Certbot

sudo python3 -m venv /opt/certbot/ && \

# Upgrade pip in the virtual environment

sudo /opt/certbot/bin/pip install --upgrade pip && \

# Install Certbot and the Certbot Nginx plugin

sudo /opt/certbot/bin/pip install certbot certbot-nginx && \

# Create a symbolic link to the certbot executable

sudo ln -s /opt/certbot/bin/certbot /usr/bin/certbot

Make sure to add the DNS records in cloud flare -> A records to the IP of the server
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

- The --standalone option is used to temporarily start a web server on port 80 to complete the domain verification. Ensure no other service is running on port 80 when you do this, which might require temporarily stopping your Docker containers. This is why we run apache on 8000 instead
- Specify all domains you want the certificate to cover with -d options.

crontab for automatic renewals

sudo yum install cronie
sudo systemctl enable crondsudo crontab -e

`0 */12 * * *` sudo docker-compose down && sudo /opt/certbot/bin/certbot renew --dry-run --post-hook "cd /home/ec2-user/josevalerio.com && sudo docker-compose up -d"

sudo docker-compose up -d and ur up :)

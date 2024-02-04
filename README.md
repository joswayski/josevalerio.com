#### Rough Readme WIP

1. Create a VPC with a public subnet

2. Create an EC2 instance with the following settings:

   - Amazon Linux 2023 AMI
   - ARM
   - t4g.nano
   - Public subnet
   - Auto-assign Public IP: Enable
   - Security group: Create a new security group
     Inbound:
     - SSH (22) - My IP (ipv6?)
     - HTTP (80) - Anywhere
     - HTTPS (443) - Anywhere
     - Custom TCP (5432) - My IP - For database access with TablePlus or your favorite database client
       Outbound:
     - All traffic - Anywhere
     - Key pair: Create a new key pair

3. Download the key pair and change the permissions

- chmod 400 “KEY_NAME.pem”

5. Connect to the instance using the IP address
   ssh -i “KEY_NAME.pem" ec2-user@ec2-XX-XXX-XX-XXX.compute-1.amazonaws.com

6. Setup your environment variables
   sudo vi /etc/environment

PG_USERNAME=blah
PG_PASSWORD=yourpassword
PG_DBNAME=yourdbname

:wq

sudo reboot

You'll have to re-connect to the instance after the reboot

7. Install git, docker, and docker-compose & pull the repo and images
   (i build them locally because i have a powerful laptop)

sudo yum update -y && sudo yum install git docker -y && sudo systemctl start docker && sudo systemctl enable docker && sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose && sudo chmod +x /usr/local/bin/docker-compose && git clone https://github.com/joswayski/josevalerio.com.git && cd josevalerio.com && sudo docker-compose pull && sudo docker-compose up -d

Make sure to add the DNS records in cloud flare -> A records to the IP of the server

Have fun!

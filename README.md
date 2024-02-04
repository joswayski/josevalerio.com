#### Rough Readme WIP

We're going to transfer files using SCP btw since GitHub does not allow cloning repos from ipv6 addresses.
https://github.com/orgs/community/discussions/10539

You might have some luck using this if your ISP does not support ipv6: https://tunnelbroker.net/new_tunnel.php

1.  Create a VPC with an ipv6 subnet - AWS is charging ~$4 / mo per ipv4 address so this is a good way to save money.
    https://aws.amazon.com/blogs/networking-and-content-delivery/introducing-ipv6-only-subnets-and-ec2-instances/

2.  Create an instance with ipv6.


3.  Create a security group with the following rules:
    Inbound:
    - SSH (22) - My IP (ipv6?)
    - HTTP (80) - Anywhere
    - HTTPS (443) - Anywhere
    - Custom TCP (5432) - My IP - For database access with TablePlus or your favorite database client
      Outbound:
    - All traffic - Anywhere

4.  Create an SSH key pair

5.  chmod 400 “KEY_NAME.pem”

6.  Connect to the instance using the ipv6 address
ssh -i “KEY_NAME.pem" ec2-user@ec2-XXXXXXXXX-.compute-1.amazonaws.com

7. Setup your environment variables
sudo vi /etc/environment

PG_USERNAME=blah
PG_PASSWORD=yourpassword
PG_DBNAME=yourdbname

:wq

sudo reboot

7. 

7. Update name servers to allow for ipv6 from github

sudo nano /etc/resolv.conf


sudo yum update -y && sudo yum install git docker -y && sudo systemctl start docker && sudo systemctl enable docker && sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose && sudo chmod +x /usr/local/bin/docker-compose && git clone https://github.com/joswayski/josevalerio.com.git && cd josevalerio.com && sudo docker-compose pull && sudo docker-compose up -d

Make sure to add the DNS records in cloud flare -> A records to the IP of the server

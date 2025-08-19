
# FCM Server Management with PM2

This guide provides simple commands to manage the FCM server using PM2.

## Navigate to Project Directory
Run the following command to navigate to the project directory:
```bash
cd  /var/www/mecocapp-server
```

## Start the Server
Start the FCM server using PM2:
```bash
pm2 start ./app.js --name fcm-server
```

## Stop the Server
Stop the FCM server process:
```bash
pm2 stop fcm-server
```

## Delete the Server Process
Remove the server process from PM2:
```bash
pm2 delete fcm-server
```

## Clear PM2 Logs
Flush all PM2 logs:
```bash
pm2 flush
```

sudo certbot certonly --manual --preferred-challenges dns -d aimcsexpo.web.app


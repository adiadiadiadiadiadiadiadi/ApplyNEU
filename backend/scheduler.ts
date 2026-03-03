import cron from 'node-cron';

cron.schedule('* * * * *', () => {
    console.log('Cron job running every minute at', new Date().toLocaleTimeString());
});
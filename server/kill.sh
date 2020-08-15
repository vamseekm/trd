echo "List of running processes"
ps aux | grep -i dist.cli.index.js | grep -i -v sh 
ps aux | grep -i dist.cli.index.js | grep -i -v sh | grep -i -v grep | awk '{print $2}' | xargs -n 1 kill -9 &> /dev/null
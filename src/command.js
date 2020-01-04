const Rx = require('rxjs');
const _ = require('lodash');

const availablePrefixColors = [
    'black', 'red', 'green',
    'yellow', 'blue', 'magenta',
    'cyan', 'white', 'gray',
];

const availablePrefixBgColors = [
    'bgBlack', 'bgRed', 'bgGreen',
    'bgYellow', 'bgBlue', 'bgMagenta',
    'bgCyan', 'bgWhite',
];

module.exports = class Command {
    get killable() {
        return !!this.process;
    }

    constructor({ index, name, command, prefixColor, killProcess, spawn, spawnOpts }) {
        this.index = index;
        this.name = name;
        this.command = command;
        this.prefixColor = this.selectPrefixColor(prefixColor);
        this.killProcess = killProcess;
        this.spawn = spawn;
        this.spawnOpts = spawnOpts;

        this.error = new Rx.Subject();
        this.close = new Rx.Subject();
        this.stdout = new Rx.Subject();
        this.stderr = new Rx.Subject();
    }

    selectPrefixColor(prefixColor) {
        return typeof prefixColor !== 'string' ? prefixColor : prefixColor
            .replace('random',
                availablePrefixColors[_.random(availablePrefixColors.length - 1)])
            .replace('bgRandom',
                availablePrefixBgColors[_.random(availablePrefixBgColors.length - 1)]);
    }

    start() {
        const child = this.spawn(this.command, this.spawnOpts);
        this.process = child;
        this.pid = child.pid;

        Rx.fromEvent(child, 'error').subscribe(event => {
            this.process = undefined;
            this.error.next(event);
        });
        Rx.fromEvent(child, 'close').subscribe(([exitCode, signal]) => {
            this.process = undefined;
            this.close.next(exitCode === null ? signal : exitCode);
        });
        child.stdout && pipeTo(Rx.fromEvent(child.stdout, 'data'), this.stdout);
        child.stderr && pipeTo(Rx.fromEvent(child.stderr, 'data'), this.stderr);
        this.stdin = child.stdin;
    }

    kill(code) {
        if (this.killable) {
            this.killProcess(this.pid, code);
        }
    }
};

function pipeTo(stream, subject) {
    stream.subscribe(event => subject.next(event));
}

require('colors');

function prettyHtml(str){
       var notIndented = str.replace(/</g, '\n<').replace(/>(.)/g, '>\n$1');
       var indent = 0;
       var indentStr = '    ';
       var notIndentedArr = notIndented.split('\n').map(function(val){
           var changeIndent = 0;
           if(!val || !val.indexOf){
             return val;
           }
           var isBr = /<br.*>/.test(val);
           if(val.indexOf('</') === 0){
                indent--;
                if(indent<0){
                    indent = 0;
                }
            }else if(val.indexOf('<') === 0 && !isBr){
               changeIndent++;
           }
           var res = indentStr.repeat(indent) + val;
           indent+=changeIndent;
           return res;
       });
       var res = notIndentedArr.join('\n');
       return res;
   }

var SpecReporter = function (baseReporterDecorator, formatError, config) {
    baseReporterDecorator(this);

    this.failures = [];

    // colorize output of BaseReporter functions
    if (config.colors) {
        this.USE_COLORS = true;
        this.SPEC_FAILURE = '%s %s FAILED'.red + '\n';
        this.SPEC_SLOW = '%s SLOW %s: %s'.yellow + '\n';
        this.ERROR = '%s ERROR'.red + '\n';
        this.FINISHED_ERROR = ' ERROR'.red;
        this.FINISHED_SUCCESS = ' SUCCESS'.green;
        this.FINISHED_DISCONNECTED = ' DISCONNECTED'.red;
        this.X_FAILED = ' (%d FAILED)'.red;
        this.TOTAL_SUCCESS = 'TOTAL: %d SUCCESS'.green + '\n';
        this.TOTAL_FAILED = 'TOTAL: %d FAILED, %d SUCCESS'.red + '\n';
    } else {
        this.USE_COLORS = false;
    }

    this.onRunComplete = function (browsers, results) {
        // the renderBrowser function is defined in karma/reporters/Base.js
        this.writeCommonMsg('\n' + browsers.map(this.renderBrowser).join('\n') + '\n');

        if (browsers.length >= 1 && !results.disconnected && !results.error) {
            if (!results.failed) {
                this.write(this.TOTAL_SUCCESS, results.success);
            } else {
                this.write(this.TOTAL_FAILED, results.failed, results.success);
                if (!this.suppressErrorSummary) {
                    this.logFinalErrors(this.failures);
                }
            }
        }

        this.write("\n");
        this.failures = [];
        this.currentSuite = [];
    };

    this.logFinalErrors = function (errors) {
        this.writeCommonMsg('\n\n');
        this.WHITESPACE = '     ';

        errors.forEach(function (failure, index) {
            index = index + 1;

            if (index > 1) {
                this.writeCommonMsg('\n');
            }

            this.writeCommonMsg((index + ') ' + failure.description + '\n').red);
            this.writeCommonMsg((this.WHITESPACE + failure.suite.join(' ') + '\n').red);
            failure.log.forEach(function (log) {
                this.writeCommonMsg(this.WHITESPACE + formatError(log).replace(/\\n/g, '\n').grey);
            }, this);
        }, this);

        this.writeCommonMsg('\n');
    };

    this.currentSuite = [];
    this.writeSpecMessage = function (status) {
        return (function (browser, result) {
            var suite = result.suite;
            var indent = "  ";
            suite.forEach(function (value, index) {
                if (index >= this.currentSuite.length || this.currentSuite[index] != value) {
                    if (index === 0) {
                        this.writeCommonMsg('\n');
                    }
                    this.writeCommonMsg(indent + value + '\n');
                    this.currentSuite = [];
                }
                indent += "  ";
            }, this);
            this.currentSuite = suite;

            var specName = result.description;
            //TODO: add timing information

            if (this.USE_COLORS) {
                if (result.skipped) specName = specName.cyan;
                else if (!result.success) specName = specName.red;
            }

            var msg = indent + status + specName;

            result.log.forEach(function (log) {
                if (reporterCfg.maxLogLines) {
                    log = log.split('\n').slice(0, reporterCfg.maxLogLines).join('\n');
                }
                msg += '\n' + formatError(log, '\t');
            });

            this.writeCommonMsg(msg + '\n');

            // other useful properties
            browser.id;
            browser.fullName;
            result.time;
            result.skipped;
            result.success;
        }).bind(this);
    };

    this.LOG_SINGLE_BROWSER = '%s LOG: %s\n';
    this.LOG_MULTI_BROWSER = '%s %s LOG: %s\n';
    this.onBrowserLog = function (browser, log, type) {
        if (this._browsers && this._browsers.length === 1) {
            this.write(this.LOG_SINGLE_BROWSER, type.toUpperCase(), this.USE_COLORS ? log.cyan : log);
        } else {
            this.write(this.LOG_MULTI_BROWSER, browser, type.toUpperCase(), this.USE_COLORS ? log.cyan : log);
        }
    };

    var reporterCfg = config.specReporter || {};
    var prefixes = reporterCfg.prefixes || {
            success: '✓ ',
            failure: '✗ ',
            skipped: '- '
        };

    function noop() {}

    this.onSpecFailure = function (browsers, results) {
        for (var i = 0; i < results.log.length; i++) {
            var log = results.log[i];
            if (log.indexOf('expected to be html equivalent.\n') !== -1) {
                results.log[i] = log.replace(
                    /(expected to be html equivalent.\n)([^\n]*\n)([^\n]*)/, function (matched, g1, g2, g3) {
                        return g1.failure + prettyHtml(g2).yellow + prettyHtml(g3).cyan
                    }
                );
            } else if (log.indexOf('not to be html equivalent') !== -1) {
                results.log[i] = log.replace(
                    /(\s*Expected\s*)('[^']+')([^']*)('[^']+')/,
                    '\n$1'.cyan + '$3'.yellow + '\n$2'.cyan + '\n$4'.yellow
                );
            } else if (log.match(/Expected.*to equal/)) {
                results.log[i] = log.replace(
                    /(Expected )(.*?)( to equal )(.*)\./,
                    '\n$1$3' + '\n$2'.cyan + '\n$4'.yellow);
            }
            if (reporterCfg['is-one-line-stack-trace']) {
                //results.log[i] = results.log[i].replace(/(at.*?\/tests\/[^\n]*)(.*\n*.*)*/, '$1')
            }
        }
        this.failures.push(results);
        this.writeSpecMessage(this.USE_COLORS ? prefixes.failure.red : prefixes.failure).apply(this, arguments);
    };

    this.specSuccess = reporterCfg['full-success-msg'] ?
        this.writeSpecMessage(this.USE_COLORS ? prefixes.success.green : prefixes.success) :
        function () {process.stdout.write(prefixes.success.green)};
    this.specSkipped = reporterCfg.suppressSkipped ? noop : this.writeSpecMessage(this.USE_COLORS ? prefixes.skipped.cyan : prefixes.skipped);
    this.specFailure = reporterCfg.suppressFailed ? noop : this.onSpecFailure;
    this.suppressErrorSummary = reporterCfg.suppressErrorSummary || false;
};

SpecReporter.$inject = ['baseReporterDecorator', 'formatError', 'config'];

module.exports = {
    'reporter:spec': ['type', SpecReporter]
};

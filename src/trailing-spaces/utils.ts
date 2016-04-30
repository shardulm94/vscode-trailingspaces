'use strict';

import jsdiff = require('diff');

/**
 * Returns all keys of an object having a true boolean value.
 *
 * @export
 * @param {Object} obj The object from which true keys need to be extracted
 * @returns {string[]} An array containing all the true keys
 */
export function getTrueKeys(obj: Object): string[] {
    let trueKeys: string[] = [];
    for (var key in obj) {
        if (obj.hasOwnProperty(key) && obj[key] == true) {
            trueKeys.push(key);
        }
    }
    return trueKeys;
}

/**
 * Gets numbers of all the lines which have changed between the two strings.
 *
 * @export
 * @param {string} oldFile A string representing the old version of the file
 * @param {string} newFile A string representing the new version of the file
 * @returns {number[]} An array containing all line numbers which have been modified
 */
export function getModifiedLineNumbers(oldFile: string, newFile: string): number[] {
    let diffs: jsdiff.IDiffResult[] = jsdiff.diffLines(oldFile, newFile);
    let lineNumber: number = 0;
    let editedLines: number[] = [];
    diffs.forEach((diff: jsdiff.IDiffResult) => {
        if (diff.added)
            editedLines.push(lineNumber);
        if (!diff.removed)
            lineNumber += diff.count;
    });
    return editedLines;
}
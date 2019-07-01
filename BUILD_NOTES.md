# Troika Build and Deployment Notes

## Continuous Integration

All pushes to the GitHub repository will be automatically built and tested by Travis CI. See all the CI builds at [https://travis-ci.org/protectwise/troika]. The current master branch status is: 

[![Build Status](https://travis-ci.org/protectwise/troika.svg?branch=master)](https://travis-ci.org/protectwise/troika)


## Publishing New Versions

When the master branch is to a point where a new release is needed, execute the following from your local repository root directory:

`lerna version`

This will prompt you for the new version number, perform all the required updates to the various `package.json` files including cross-referenced dependency versions, create a new Git tag for that version, and push the result to GitHub.

If you don't want it to push to GitHub yet, use:

`lerna version --no-push`

...and then manually push to GitHub when you're ready (don't forget to push the tag!)

At this point Travis CI will build and test the new tagged version, but it is _not_ currently set up to publish the results to the NPM registry; for the time being that will be a manual process. To do that:
 
 - Make sure the tagged commit is checked out, with no extra files hanging around
 - Run: `npm build`
 - Make sure you're logged in to an NPM account with permissions to publish to the various troika packages (`npm login`)
 - Run: `lerna publish from-git`
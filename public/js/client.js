/* global TrelloPowerUp */
var Promise = TrelloPowerUp.Promise;

var PR_ICON = 'https://github.trello.services/images/pull-request.svg?color=fff';

var GITHUB_ICON = 'https://github.trello.services/images/icon.svg?color=42536e';

import auth from './auth'
auth()

TrelloPowerUp.initialize({
  "card-badges": function(
    t,
    options /* Returns some data from current card like id, etc*/
  ) {
    const apiAttachment = options.attachments.find((attachment) => attachment.url.match(/api.github.com/u))

    if (!apiAttachment) {
      return []
    }

    return t.get('board', 'shared', 'github_user_info').then((githubUserInfo) => {
      const githubToken = githubUserInfo.ghToken

      return [
        {
          dynamic: function() {
            return fetch(apiAttachment.url, {
              headers: {
                Authorization: `token ${githubToken}`
              }
            })
            .then((result) => result.json())
            .then((pullRequest) => {
              // console.log(pullRequest);

              return {
                text: pullRequest.state,
                icon: PR_ICON,
                color: pullRequest.state === 'open'
                ? 'green'
                : 'purple',
                refresh: 30
              }
            })
          }
        },
        {
          dynamic: function() {
            const getPrReviews = `${apiAttachment.url}/reviews`;

            return fetch(getPrReviews, {
              headers: {
                Authorization: `token ${githubToken}`
              }
            })
            .then((result) => result.json())
            .then((reviews) => {
              // console.log(pullRequest);
              let approvedCount = 0;

              const text = reviews.reduce((accumulator, review /*state user.login*/) => {
                let currentAccumulator = accumulator;

                let statusLabel = ''

                if (review.state === 'APPROVED') {
                  statusLabel = 'OK'
                  approvedCount += 1
                } else {
                  statusLabel = 'NO'
                }

                const nameAndStatus = `${review.user.login.substring(0, 1).toLocaleUpperCase()}: ${statusLabel} `

                currentAccumulator += nameAndStatus

                return currentAccumulator
              }, '') || 'No Reviews'

              return {
                text,
                color: approvedCount > 1
                ? 'green'
                : 'yellow',
                refresh: 30
              }
            })
          }
        }
      ]
    })
    .catch((err) => {
      console.log(err);
    })
  },
  "board-buttons": function(/*t, opts*/) {
    return [
      {
        // Remove all shared board data(pr links) in case of exceed the trello power up storage
        text: 'Reset data',
        callback: function(t) {
          const allowedKeys = ['github_user_info'];

          t.get('board', 'shared').then((result) => {
            // We don't want remove settings data only saved pr urls
            const keysToRemove = Object.keys(result).filter((key) => !allowedKeys.includes(key));

            t.remove('board', 'shared', keysToRemove);
          })
        }
      },
      {
        // we can either provide a button that has a callback function
        icon: {
          dark: PR_ICON,
          light: PR_ICON
        },
        text: "Sync Pull Requests",
        condition: "edit",
        callback: function(t) {
          let listBoardId = ''

          t.get('board', 'shared', 'github_user_info').then((githubUserInfo) => {
            const githubToken = githubUserInfo.ghToken
            // const pullRequestUrl = githubUserInfo.pullRequestUrl
            listBoardId = githubUserInfo.listBoardId

            return Promise.all(githubUserInfo.pullRequestRepoUrls.map((pullRequestUrl) => {
                return fetch(pullRequestUrl, {
                  headers: {
                    Authorization: `token ${githubToken}`
                  }
                });
              })
            )
          })
          .then((results) => {
            console.log(results);

            return Promise.all(results.map((result) => result.json()))
          })
          .then((githubRepoPullRequests) => {

            //
            // Pull requests return
            //
            // [
            // [
            //     {
            //       html_url: 'asdas1dasd',
            //       id: 23123
            //     },
            //     {
            //       html_url: 'aswdasdasd',
            //       id: 343332
            //     }
            // ],
            // [
            //     {
            //       html_url: 'asdwasdasd',
            //       id: 44
            //     },
            //     {
            //       html_url: 'asdasd34asd',
            //       id: 34332
            //     }
            // ]
            // ]
            //

            const flattedRepoPullRequests = githubRepoPullRequests.reduce((acc, githubRepoPullRequest) => {
              return [...acc, ...githubRepoPullRequest]
            }, [])

            return Promise.all([
              flattedRepoPullRequests,
              t.get('board', 'shared')
            ])
          })
          .then(([githubPullRequests, boardData]) => {
            console.log(githubPullRequests);
            const allPrs = {}
            const allExistentPrs = Object.keys(boardData);

            // Get a list of created cards to remove in case of a error on set board shared data
            // currently that error could appear when you save a lot of prs on your trello's board
            // Unhandled rejection Error: PluginData length of 8192 characters exceeded. See:
            //
            const createdCardIds = [];

            const githubPullRequestsFiltered = githubPullRequests
              .filter((pullRequest) => {
                console.log(boardData.github_user_info.skipPrName || '');

                if ((boardData.github_user_info.skipPrName || '').length > 0){
                  return pullRequest.title.indexOf(boardData.github_user_info.skipPrName) < 0;
                } else {
                  return true;
                }
              });

            const getRequestsMap = githubPullRequestsFiltered.map(pullRequest => {
              const pullRequestUrl = pullRequest.html_url;

              // Check if pr is already tracked on a Trello's card
              if (!allExistentPrs.includes(pullRequestUrl)) {
                const pullRequestApiUrl = pullRequest.url;
                const userName = pullRequest.user.login;
                const updatedPr = pullRequest.updated_at;
                const splittedUrl = pullRequestUrl.split('/');
                const prNumber = splittedUrl[splittedUrl.length - 1];
                const cardTitle = pullRequest.title;
                const repoName = pullRequest.base.repo.name
                const draftLabel =
                  pullRequest.draft === true
                    ? '[Draft]'
                    : '';

                return window.Trello.post("/card", {
                  name: `${cardTitle} ${draftLabel} [${repoName}] [${userName}] #${prNumber} [${updatedPr}]`,
                  idList: listBoardId,
                  pos: "top"
                }).then(card => {
                  window.Trello.post(`/card/${card.id}/attachments`, {
                    name: "github pull request",
                    url: pullRequestUrl
                  });

                  return card
                })
                .then((card) => {
                  createdCardIds.push(card.id);

                  return window.Trello.post(`/card/${card.id}/attachments`, {
                    name: "github pull request api",
                    url: pullRequestApiUrl
                  });
                })
                .then(() => {
                  allPrs[pullRequestUrl] = true
                })
                .catch((err) => {
                  console.log(err);
                })
              }

              return null
            })

            Promise.all(getRequestsMap).then(() => {
              console.log(allPrs);
              return t.set('board', 'shared', allPrs);
            })
            .then(() => {
              t.get('board', 'shared').then((data) => {
                console.log(data);
              })
            })
            .catch((err) => {
              console.log(err);
              console.log('--- PANIC: starting removing the created cards prs ---');

              createdCardIds.forEach((cardId) => {
                console.log(`removed: ${cardId}`);
                window.Trello.delete(`/cards/${cardId}`);
              })
            })
          })
          .catch((err) => {
            console.log(err);
          })
          // End
        }
      },
      {
        icon: GITHUB_ICON,
        text: "Configure your github account",
        callback: function(t) {
          return t.popup({
            title: "GitHub Selection",
            url: "/public/github_info_popup.html"
          });
        }
      }
    ];
  }
});

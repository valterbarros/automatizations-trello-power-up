/* global TrelloPowerUp */
import trelloAuth from './auth'

trelloAuth()

var t = TrelloPowerUp.iframe()

/* eslint-disable max-params */
function mountSelectOptions(collection, selectSelector, displayKey, valueKey) {
  collection.forEach((item) => {
    const option = document.createElement('option');
    option.text = item[displayKey]
    option.value = item[valueKey]

    const selectElement = document.querySelector(selectSelector)
    selectElement.add(option)
  })
}

document.querySelector('#jsghselection').addEventListener('submit', (event) => {
  event.preventDefault()

  const ghToken = document.querySelector('#js_gh_token').value
  const pullRequestUrl = document.querySelector('#js_gh_repository')
  const listBoardId = document.querySelector('#js_gh_board_list')

  return t.set('board', 'shared', 'github_user_info', {
    ghToken,
    pullRequestUrl: pullRequestUrl.value,
    listBoardId: listBoardId.value
  })
  .then(() => {
    t.closePopup()
  })
})

// Like a popup constructor as soon as the pop up rendes on the screen it will be called
t.render(() => {
  t.get('board', 'shared', 'github_user_info').then((githubUserInfo) => {
    const githubToken = githubUserInfo.ghToken

    t.board('id').then((board) => {
      return window.Trello.get(`/boards/${board.id}/lists`)
      .then((lists) => {
        mountSelectOptions(lists, '#js_gh_board_list', 'name', 'id')
      })
      .catch((err) => {
        console.log(err);
      })
    })
    .then(() => {
      document.querySelector('#js_gh_board_list').value = githubUserInfo.listBoardId
    })
    .catch((err) => {
      console.log(err);
    })

    const reposUrl = `https://api.github.com/user/repos?sort=pushed&per_page=20`

    fetch(reposUrl, {
      headers: {
        Authorization: `token ${githubToken}`
      }
    })
    .then((reposResponse) => reposResponse.json())
    .then((repos) => {
      const mapRepo = repos.map((repo) => {
        return {
          fullName: repo.full_name,
          pullUrl: repo.pulls_url.replace(/\{\/number\}/gu, '')
        }
      })

      console.log(mapRepo);

      mountSelectOptions(mapRepo, '#js_gh_repository', 'fullName', 'pullUrl')
    })
    .then(() => {
      document.querySelector('#js_gh_repository').value = githubUserInfo.pullRequestUrl
    })
  })
  .then((result) => {
    console.log(result);
  })

  const ghToken = document.querySelector('#js_gh_token')
  const pullRequestUrl = document.querySelector('#js_gh_repository')
  const listBoardId = document.querySelector('#js_gh_board_list')

  t.get('board', 'shared', 'github_user_info').then((personalGithubData) => {
    console.log(personalGithubData)
    ghToken.value = personalGithubData.ghToken
    pullRequestUrl.value = personalGithubData.pullRequestUrl
    listBoardId.value = personalGithubData.listBoardId
  })
  .then(() => {
    t.sizeTo('#jsghselection').done()
  })
})

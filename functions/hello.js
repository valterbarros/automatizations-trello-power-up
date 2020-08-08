exports.handler = function(event, context, callback) {
  console.log(callback);
  
  callback(null, {
    statusCode: 200,
    body: JSON.stringify({ msg: 'hello' })
  });
}
